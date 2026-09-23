import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const getFinanceSettings = vi.fn();
vi.mock("@/lib/services/finance-settings.service", () => ({
  getFinanceSettings: (...a: unknown[]) => getFinanceSettings(...a),
}));
// The default customerRepository singleton pulls in the real prisma client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  CustomerService,
  neutralizeSpreadsheetFormula,
  toCustomerRowDto,
} from "../customer.service";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";

const NOW = new Date("2026-09-01T10:00:00Z");

const customer = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  storeId: "s1",
  name: "Ana",
  phone: "+33612345678",
  email: null,
  notes: null,
  points: 0,
  memberSince: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

function makeRepo() {
  return {
    findPage: vi.fn(),
    aggregateOrders: vi.fn().mockResolvedValue(new Map()),
    summary: vi.fn(),
    findById: vi.fn(),
    findByPhone: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    recentOrders: vi.fn().mockResolvedValue([]),
    recentLoyaltyEntries: vi.fn().mockResolvedValue([]),
    adjustPoints: vi.fn(),
  };
}

let repo: ReturnType<typeof makeRepo>;
let service: CustomerService;

beforeEach(() => {
  vi.clearAllMocks();
  getFinanceSettings.mockResolvedValue({ currency: "EUR" });
  repo = makeRepo();
  service = new CustomerService(repo as unknown as CustomerRepository);
});

describe("toCustomerRowDto", () => {
  it("serialises dates and defaults the computed figures to zero", () => {
    expect(toCustomerRowDto(customer({ memberSince: NOW, points: 12 }) as never)).toEqual({
      id: "c1",
      name: "Ana",
      phone: "+33612345678",
      email: null,
      notes: null,
      points: 12,
      memberSince: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      lifetimeSpend: 0,
      orderCount: 0,
      lastOrderAt: null,
    });
  });
});

describe("list", () => {
  it("joins the page with per-customer aggregates and passes totals through", async () => {
    repo.findPage.mockResolvedValue({
      customers: [customer(), customer({ id: "c2", name: "Bo" })],
      nextCursor: "c2",
      totalCount: 40,
    });
    repo.aggregateOrders.mockResolvedValue(
      new Map([["c1", { lifetimeSpend: 55.5, orderCount: 2, lastOrderAt: NOW }]])
    );

    const out = await service.list("s1", { limit: 2, sort: "name", includeSummary: false });

    expect(repo.aggregateOrders).toHaveBeenCalledWith("s1", ["c1", "c2"]);
    expect(out.customers[0]).toMatchObject({
      id: "c1",
      lifetimeSpend: 55.5,
      orderCount: 2,
      lastOrderAt: NOW.toISOString(),
    });
    // A customer with no revenue orders is zero, not missing.
    expect(out.customers[1]).toMatchObject({
      id: "c2",
      lifetimeSpend: 0,
      orderCount: 0,
      lastOrderAt: null,
    });
    expect(out.nextCursor).toBe("c2");
    expect(out.totalCount).toBe(40);
    expect(out).not.toHaveProperty("summary");
    expect(repo.summary).not.toHaveBeenCalled();
  });

  it("adds the store-wide summary only when asked", async () => {
    repo.findPage.mockResolvedValue({ customers: [], nextCursor: null, totalCount: 0 });
    repo.summary.mockResolvedValue({ members: 3, nonMembers: 7, pointsRedeemedTotal: 90 });

    const out = await service.list("s1", {
      limit: 25,
      sort: "name",
      includeSummary: true,
      q: "an",
    });

    expect(out.summary).toEqual({ members: 3, nonMembers: 7, pointsRedeemedTotal: 90 });
    // The tiles are store-wide: the search term must not reach the summary query.
    expect(repo.summary).toHaveBeenCalledWith("s1");
  });
});

describe("create", () => {
  it("normalises the phone to E.164 before the duplicate check and the write", async () => {
    repo.create.mockResolvedValue(customer());

    await service.create("s1", { name: "Ana", phone: "+33 6 12 34 56 78" });

    expect(repo.findByPhone).toHaveBeenCalledWith("s1", "+33612345678", undefined);
    expect(repo.create).toHaveBeenCalledWith({
      storeId: "s1",
      name: "Ana",
      phone: "+33612345678",
      email: null,
      notes: null,
    });
  });

  it("uses the store's currency to complete a national number, and only looks it up when needed", async () => {
    repo.create.mockResolvedValue(customer());

    await service.create("s1", { name: "Ana", phone: "+33612345678" });
    expect(getFinanceSettings).not.toHaveBeenCalled();

    await service.create("s1", { name: "Ana", phone: "06 12 34 56 78" });
    expect(getFinanceSettings).toHaveBeenCalledWith("s1");
    expect(repo.findByPhone).toHaveBeenLastCalledWith("s1", "+33612345678", undefined);

    getFinanceSettings.mockResolvedValue({ currency: "IDR" });
    await service.create("s1", { name: "Budi", phone: "0812-3456-7890" });
    expect(repo.findByPhone).toHaveBeenLastCalledWith("s1", "+6281234567890", undefined);
  });

  it("answers a number it cannot canonicalise with a 400 on the phone field", async () => {
    getFinanceSettings.mockResolvedValue({ currency: "JPY" }); // unknown country => national numbers are ambiguous

    await expect(service.create("s1", { name: "Ana", phone: "0612345678" })).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: "phone" }],
    });
    await expect(service.create("s1", { name: "Ana", phone: "abc" })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses a duplicate phone in the store with a 409 CONFLICT on the phone field", async () => {
    repo.findByPhone.mockResolvedValue(customer({ name: "Existing Ana" }));

    await expect(
      service.create("s1", { name: "Ana 2", phone: "+33612345678" })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
      details: [{ field: "phone", message: expect.stringContaining("Existing Ana") }],
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("maps a lost race (P2002) to the same 409", async () => {
    repo.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "t" })
    );

    await expect(
      service.create("s1", { name: "Ana", phone: "+33612345678" })
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("re-throws anything that is not a uniqueness violation", async () => {
    const boom = new Error("db down");
    repo.create.mockRejectedValue(boom);
    await expect(service.create("s1", { name: "Ana" })).rejects.toBe(boom);
  });

  it("a customer with no phone is fine (walk-in with a name) and skips the phone work", async () => {
    repo.create.mockResolvedValue(customer({ phone: null }));

    await service.create("s1", { name: "Walk-in", email: "a@b.co", notes: "regular" });

    expect(repo.findByPhone).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith({
      storeId: "s1",
      name: "Walk-in",
      phone: null,
      email: "a@b.co",
      notes: "regular",
    });
  });

  it("names a customer created from a phone alone after the normalised number", async () => {
    // The POS captures a WhatsApp number first; name and email are optional
    // extras the customer may never give. Customer.name is NOT NULL, so the
    // record is named after the number — the canonical one, not what was typed.
    repo.create.mockResolvedValue(customer({ name: "+33612345678" }));

    await service.create("s1", { phone: "06 12 34 56 78" });

    expect(repo.create).toHaveBeenCalledWith({
      storeId: "s1",
      name: "+33612345678",
      phone: "+33612345678",
      email: null,
      notes: null,
    });
  });

  it("keeps a name that was given rather than overwriting it with the phone", async () => {
    repo.create.mockResolvedValue(customer());

    await service.create("s1", { name: "Ana", phone: "+33612345678" });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Ana" }));
  });

  it("refuses a customer with neither a name nor a phone", async () => {
    await expect(service.create("s1", { email: "a@b.co" })).rejects.toMatchObject({
      details: [{ field: "name" }],
    });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("getDetail", () => {
  it("is a 404 for a customer of another store (the lookup is store-scoped)", async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.getDetail("s1", "c-foreign")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findById).toHaveBeenCalledWith("s1", "c-foreign");
  });

  it("returns the row plus the last 20 orders and 30 ledger entries, money as numbers", async () => {
    repo.findById.mockResolvedValue(customer({ points: 40 }));
    repo.recentOrders.mockResolvedValue([
      {
        id: "o1",
        orderNumber: "POS-1",
        orderDate: NOW,
        total: new Prisma.Decimal("12.50"),
        status: "DELIVERED",
      },
    ]);
    repo.recentLoyaltyEntries.mockResolvedValue([
      { id: "l1", type: "EARN", points: 12, note: null, orderId: "o1", createdAt: NOW },
    ]);

    const out = await service.getDetail("s1", "c1");

    expect(repo.recentOrders).toHaveBeenCalledWith("s1", "c1", 20);
    expect(repo.recentLoyaltyEntries).toHaveBeenCalledWith("c1", 30);
    expect(out.orders).toEqual([
      {
        id: "o1",
        orderNumber: "POS-1",
        orderDate: NOW.toISOString(),
        total: 12.5,
        status: "DELIVERED",
      },
    ]);
    expect(out.loyaltyEntries).toEqual([
      {
        id: "l1",
        type: "EARN",
        points: 12,
        note: null,
        orderId: "o1",
        createdAt: NOW.toISOString(),
      },
    ]);
  });
});

describe("update", () => {
  beforeEach(() => {
    repo.findById.mockResolvedValue(customer());
    repo.update.mockResolvedValue(customer());
  });

  it("is a 404 for an unknown customer", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.update("s1", "cx", { name: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("writes only the fields that were sent", async () => {
    await service.update("s1", "c1", { notes: "vip" });
    expect(repo.update).toHaveBeenCalledWith("c1", { notes: "vip" });
  });

  it("null clears the phone without any phone work", async () => {
    await service.update("s1", "c1", { phone: null });
    expect(repo.update).toHaveBeenCalledWith("c1", { phone: null });
    expect(repo.findByPhone).not.toHaveBeenCalled();
  });

  it("checks a NEW phone against every other customer (excluding this one)", async () => {
    await service.update("s1", "c1", { phone: "+33 7 00 00 00 01" });
    expect(repo.findByPhone).toHaveBeenCalledWith("s1", "+33700000001", "c1");
    expect(repo.update).toHaveBeenCalledWith("c1", { phone: "+33700000001" });
  });

  it("does not flag a customer's own, unchanged phone as a duplicate", async () => {
    await service.update("s1", "c1", { phone: "+33 6 12 34 56 78" });
    expect(repo.findByPhone).not.toHaveBeenCalled();
  });

  it("refuses a phone another customer holds with a 409", async () => {
    repo.findByPhone.mockResolvedValue(customer({ id: "c2", name: "Bo" }));
    await expect(service.update("s1", "c1", { phone: "+33700000001" })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe("adjustPoints", () => {
  it("returns the updated row with its computed figures", async () => {
    repo.adjustPoints.mockResolvedValue({ kind: "ok", customer: customer({ points: 80 }) });
    repo.aggregateOrders.mockResolvedValue(
      new Map([["c1", { lifetimeSpend: 10, orderCount: 1, lastOrderAt: NOW }]])
    );

    const out = await service.adjustPoints("s1", "c1", { points: 30, note: "goodwill" });

    expect(repo.adjustPoints).toHaveBeenCalledWith("s1", "c1", 30, "goodwill");
    expect(out).toMatchObject({ points: 80, lifetimeSpend: 10, orderCount: 1 });
  });

  it("a removal that would take the balance below zero is a 400 pinned to the points field", async () => {
    repo.adjustPoints.mockResolvedValue({ kind: "insufficient", balance: 10 });

    await expect(
      service.adjustPoints("s1", "c1", { points: -30, note: "x" })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: "points", message: expect.stringContaining("only has 10 points") }],
    });
  });

  it("is a 404 for a customer of another store", async () => {
    repo.adjustPoints.mockResolvedValue({ kind: "not_found" });
    await expect(service.adjustPoints("s1", "cx", { points: 1, note: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("exportCsv", () => {
  it("writes a header, one row per customer, and English column names", async () => {
    repo.findPage.mockResolvedValue({
      customers: [customer({ points: 5, memberSince: NOW })],
      nextCursor: null,
      totalCount: 1,
    });
    repo.aggregateOrders.mockResolvedValue(
      new Map([["c1", { lifetimeSpend: 1234.5, orderCount: 4, lastOrderAt: NOW }]])
    );

    const csv = await service.exportCsv("s1");
    const [header, line] = csv.split("\n");

    expect(header).toBe(
      "Name,Phone,Email,Notes,Customer since,Member since,Points,Lifetime spend,Orders,Last visit"
    );
    expect(line).toBe(
      `Ana,+33612345678,,,${NOW.toISOString()},${NOW.toISOString()},5,1234.50,4,${NOW.toISOString()}`
    );
  });

  it("walks every page (cursor) rather than stopping at the first", async () => {
    repo.findPage
      .mockResolvedValueOnce({
        customers: [customer({ id: "c1" })],
        nextCursor: "c1",
        totalCount: 2,
      })
      .mockResolvedValueOnce({
        customers: [customer({ id: "c2", name: "Bo", phone: null })],
        nextCursor: null,
        totalCount: 2,
      });

    const csv = await service.exportCsv("s1", "an");

    expect(csv.split("\n")).toHaveLength(3); // header + 2
    expect(repo.findPage.mock.calls[0][1]).toMatchObject({
      q: "an",
      cursor: undefined,
      sort: "name",
    });
    expect(repo.findPage.mock.calls[1][1]).toMatchObject({ cursor: "c1" });
  });

  it("defuses spreadsheet formulas in free-text cells, but leaves the phone's leading + alone", async () => {
    repo.findPage.mockResolvedValue({
      customers: [
        customer({ name: '=HYPERLINK("http://evil")', notes: "@SUM(A1)", email: "-x@y.z" }),
      ],
      nextCursor: null,
      totalCount: 1,
    });

    const csv = await service.exportCsv("s1");

    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-x@y.z");
    expect(csv).toContain(",+33612345678,");
  });
});

describe("neutralizeSpreadsheetFormula", () => {
  it("prefixes only the dangerous leading characters", () => {
    for (const v of ["=1+1", "+1", "-1", "@a", "\tx", "\rx"]) {
      expect(neutralizeSpreadsheetFormula(v), JSON.stringify(v)).toBe(`'${v}`);
    }
    expect(neutralizeSpreadsheetFormula("Ana")).toBe("Ana");
    expect(neutralizeSpreadsheetFormula("a=b")).toBe("a=b");
    expect(neutralizeSpreadsheetFormula(null)).toBe("");
    expect(neutralizeSpreadsheetFormula("")).toBe("");
  });
});
