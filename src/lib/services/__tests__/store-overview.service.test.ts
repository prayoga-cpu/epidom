import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findMany: vi.fn() },
    order: { groupBy: vi.fn() },
    customer: { groupBy: vi.fn() },
    staffMember: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { getStoreOverviews } from "../store-overview.service";

const findMany = vi.mocked(prisma.store.findMany) as unknown as ReturnType<typeof vi.fn>;
const orderGroupBy = vi.mocked(prisma.order.groupBy) as unknown as ReturnType<typeof vi.fn>;
const customerGroupBy = vi.mocked(prisma.customer.groupBy) as unknown as ReturnType<typeof vi.fn>;
const staffGroupBy = vi.mocked(prisma.staffMember.groupBy) as unknown as ReturnType<typeof vi.fn>;

type FinanceRow = { currency: string; market: "INDONESIA" | "FRANCE" | "INTERNATIONAL" } | null;
type StorefrontRow = {
  tagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  themeColor: string;
} | null;

/** A row shaped like the service's store.findMany select. */
const storeRow = (
  id: string,
  over: {
    businessId?: string;
    syncFinanceWithBusiness?: boolean;
    financeSettings?: FinanceRow;
    businessFinance?: FinanceRow;
    storefront?: StorefrontRow;
  } = {}
) => ({
  id,
  businessId: over.businessId ?? "biz_1",
  syncFinanceWithBusiness: over.syncFinanceWithBusiness ?? false,
  financeSettings: over.financeSettings ?? null,
  business: { financeSettings: over.businessFinance ?? null },
  storefront: over.storefront ?? null,
});

const storefront = (over: Partial<NonNullable<StorefrontRow>> = {}) => ({
  tagline: null,
  logoUrl: null,
  heroImageUrl: null,
  themeColor: "#FF6B35",
  ...over,
});

const owner = { businessId: "biz_1", linkedStoreId: null, includeTotals: true };

beforeEach(() => {
  findMany.mockReset();
  orderGroupBy.mockReset();
  customerGroupBy.mockReset();
  staffGroupBy.mockReset();
  findMany.mockResolvedValue([]);
  orderGroupBy.mockResolvedValue([]);
  customerGroupBy.mockResolvedValue([]);
  staffGroupBy.mockResolvedValue([]);
});

describe("getStoreOverviews: which stores", () => {
  it("no business and no staff link: [] without touching the database", async () => {
    const result = await getStoreOverviews({
      businessId: null,
      linkedStoreId: null,
      includeTotals: true,
    });

    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(orderGroupBy).not.toHaveBeenCalled();
    expect(customerGroupBy).not.toHaveBeenCalled();
    expect(staffGroupBy).not.toHaveBeenCalled();
  });

  it("reads the owned stores and the linked-staff store in ONE query, newest first, never creating a storefront", async () => {
    await getStoreOverviews({ businessId: "biz_1", linkedStoreId: "theirs", includeTotals: true });

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ OR: [{ businessId: "biz_1" }, { id: "theirs" }] });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
    expect(arg.select.storefront).toEqual({
      select: { tagline: true, logoUrl: true, heroImageUrl: true, themeColor: true },
    });
  });

  it("a staff-only account (no business) is scoped to its linked store alone, and no totals are queried", async () => {
    findMany.mockResolvedValue([storeRow("theirs", { businessId: "biz_other" })]);

    const result = await getStoreOverviews({
      businessId: null,
      linkedStoreId: "theirs",
      includeTotals: true,
    });

    expect(findMany.mock.calls[0][0].where).toEqual({ OR: [{ id: "theirs" }] });
    expect(orderGroupBy).not.toHaveBeenCalled();
    expect(customerGroupBy).not.toHaveBeenCalled();
    expect(staffGroupBy).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].stats).toBeNull();
  });

  it("a store that is both owned and staff-linked comes back once, with stats", async () => {
    // The OR query returns a matching row once; the service must not add it again.
    findMany.mockResolvedValue([storeRow("same")]);
    orderGroupBy.mockResolvedValue([{ storeId: "same", _sum: { total: new Prisma.Decimal(10) } }]);

    const result = await getStoreOverviews({
      businessId: "biz_1",
      linkedStoreId: "same",
      includeTotals: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ storeId: "same", stats: { revenue: 10 } });
  });

  it("keeps the database order (createdAt desc)", async () => {
    findMany.mockResolvedValue([storeRow("newer"), storeRow("older")]);

    const result = await getStoreOverviews(owner);

    expect(result.map((o) => o.storeId)).toEqual(["newer", "older"]);
  });
});

describe("getStoreOverviews: totals", () => {
  it("revenue is the app's definition: Σ total over orders not CANCELLED/HELD, scoped to the session's business", async () => {
    await getStoreOverviews(owner);

    expect(orderGroupBy).toHaveBeenCalledTimes(1);
    expect(orderGroupBy.mock.calls[0][0]).toEqual({
      by: ["storeId"],
      where: { store: { businessId: "biz_1" }, status: { notIn: NON_REVENUE_STATUSES } },
      _sum: { total: true },
    });
  });

  it("rounds a Decimal sum to 2 decimals, and a store with no orders gets 0", async () => {
    findMany.mockResolvedValue([storeRow("a"), storeRow("b")]);
    orderGroupBy.mockResolvedValue([
      { storeId: "a", _sum: { total: new Prisma.Decimal("1234.567") } },
    ]);

    const result = await getStoreOverviews(owner);

    expect(result.find((o) => o.storeId === "a")?.stats?.revenue).toBe(1234.57);
    expect(result.find((o) => o.storeId === "b")?.stats?.revenue).toBe(0);
  });

  it("a null _sum (a group with no totals) is 0, not NaN", async () => {
    findMany.mockResolvedValue([storeRow("a")]);
    orderGroupBy.mockResolvedValue([{ storeId: "a", _sum: { total: null } }]);

    const result = await getStoreOverviews(owner);

    expect(result[0].stats?.revenue).toBe(0);
  });

  it("customers are the store's Customer rows; a store with none gets 0", async () => {
    findMany.mockResolvedValue([storeRow("a"), storeRow("b")]);
    customerGroupBy.mockResolvedValue([{ storeId: "a", _count: { _all: 42 } }]);

    const result = await getStoreOverviews(owner);

    expect(customerGroupBy.mock.calls[0][0]).toEqual({
      by: ["storeId"],
      where: { store: { businessId: "biz_1" } },
      _count: { _all: true },
    });
    expect(result.find((o) => o.storeId === "a")?.stats?.customerCount).toBe(42);
    expect(result.find((o) => o.storeId === "b")?.stats?.customerCount).toBe(0);
  });

  it("staff counts only active, non-OWNER rows; a store with only an OWNER or deactivated rows gets 0", async () => {
    findMany.mockResolvedValue([storeRow("a"), storeRow("owner_only")]);
    // The database applies the filter, so the owner-only store has no group.
    staffGroupBy.mockResolvedValue([{ storeId: "a", _count: { _all: 3 } }]);

    const result = await getStoreOverviews(owner);

    expect(staffGroupBy.mock.calls[0][0]).toEqual({
      by: ["storeId"],
      where: { store: { businessId: "biz_1" }, isActive: true, role: { not: "OWNER" } },
      _count: { _all: true },
    });
    expect(result.find((o) => o.storeId === "a")?.stats?.staffCount).toBe(3);
    expect(result.find((o) => o.storeId === "owner_only")?.stats?.staffCount).toBe(0);
  });

  it("an owned store with no activity at all gets zeroed stats, not null", async () => {
    findMany.mockResolvedValue([storeRow("fresh")]);

    const result = await getStoreOverviews(owner);

    expect(result[0].stats).toEqual({ revenue: 0, customerCount: 0, staffCount: 0 });
  });

  it("includeTotals false (a non-OWNER PIN persona): no groupBy runs and every row has stats null", async () => {
    findMany.mockResolvedValue([storeRow("a"), storeRow("b")]);

    const result = await getStoreOverviews({ ...owner, includeTotals: false });

    expect(orderGroupBy).not.toHaveBeenCalled();
    expect(customerGroupBy).not.toHaveBeenCalled();
    expect(staffGroupBy).not.toHaveBeenCalled();
    expect(result.map((o) => o.stats)).toEqual([null, null]);
  });

  it("the linked-staff store (another business) never gets stats, even with totals on, and its figures are never read", async () => {
    findMany.mockResolvedValue([storeRow("mine"), storeRow("theirs", { businessId: "biz_other" })]);
    // Even if a group for the foreign store somehow came back, it must not show.
    orderGroupBy.mockResolvedValue([
      { storeId: "mine", _sum: { total: new Prisma.Decimal(5) } },
      { storeId: "theirs", _sum: { total: new Prisma.Decimal(999) } },
    ]);

    const result = await getStoreOverviews({
      businessId: "biz_1",
      linkedStoreId: "theirs",
      includeTotals: true,
    });

    expect(result.find((o) => o.storeId === "mine")?.stats?.revenue).toBe(5);
    expect(result.find((o) => o.storeId === "theirs")?.stats).toBeNull();
    // Every totals query is scoped to the caller's own business, never the linked store.
    for (const spy of [orderGroupBy, customerGroupBy, staffGroupBy]) {
      expect(spy.mock.calls[0][0].where.store).toEqual({ businessId: "biz_1" });
    }
  });
});

describe("getStoreOverviews: currency and market", () => {
  it("sync off: the store's own finance row", async () => {
    findMany.mockResolvedValue([
      storeRow("a", {
        financeSettings: { currency: "EUR", market: "FRANCE" },
        businessFinance: { currency: "IDR", market: "INDONESIA" },
      }),
    ]);

    const [row] = await getStoreOverviews(owner);

    expect(row).toMatchObject({ currency: "EUR", market: "FRANCE" });
  });

  it("sync on: the business's row, even when the store has its own", async () => {
    findMany.mockResolvedValue([
      storeRow("a", {
        syncFinanceWithBusiness: true,
        financeSettings: { currency: "EUR", market: "FRANCE" },
        businessFinance: { currency: "USD", market: "INTERNATIONAL" },
      }),
    ]);

    const [row] = await getStoreOverviews(owner);

    expect(row).toMatchObject({ currency: "USD", market: "INTERNATIONAL" });
  });

  it("no row, in either mode: IDR / INDONESIA", async () => {
    findMany.mockResolvedValue([
      storeRow("own_missing"),
      storeRow("synced_missing", {
        syncFinanceWithBusiness: true,
        financeSettings: { currency: "EUR", market: "FRANCE" },
      }),
    ]);

    const result = await getStoreOverviews(owner);

    for (const row of result) {
      expect(row).toMatchObject({ currency: "IDR", market: "INDONESIA" });
    }
  });

  it("each store keeps its own currency: an EUR store under an IDR business stays EUR", async () => {
    findMany.mockResolvedValue([
      storeRow("paris", {
        financeSettings: { currency: "EUR", market: "FRANCE" },
        businessFinance: { currency: "IDR", market: "INDONESIA" },
      }),
      storeRow("jakarta", {
        syncFinanceWithBusiness: true,
        businessFinance: { currency: "IDR", market: "INDONESIA" },
      }),
    ]);

    const result = await getStoreOverviews(owner);

    expect(result.map((o) => [o.storeId, o.currency])).toEqual([
      ["paris", "EUR"],
      ["jakarta", "IDR"],
    ]);
  });
});

describe("getStoreOverviews: storefront branding and slogan", () => {
  it("a store with no storefront row: null tagline, logo, cover and themeColor", async () => {
    findMany.mockResolvedValue([storeRow("a")]);

    const [row] = await getStoreOverviews(owner);

    expect(row).toMatchObject({ tagline: null, logoUrl: null, coverUrl: null, themeColor: null });
  });

  it("the tagline is trimmed, and '' or whitespace is null", async () => {
    findMany.mockResolvedValue([
      storeRow("trimmed", { storefront: storefront({ tagline: "  Best kopi  " }) }),
      storeRow("empty", { storefront: storefront({ tagline: "" }) }),
      storeRow("spaces", { storefront: storefront({ tagline: "   " }) }),
      storeRow("missing", { storefront: storefront({ tagline: null }) }),
    ]);

    const result = await getStoreOverviews(owner);

    expect(result.map((o) => o.tagline)).toEqual(["Best kopi", null, null, null]);
  });

  it("logoUrl and heroImageUrl pass through as logoUrl and coverUrl, and '' (a cleared image) is null", async () => {
    findMany.mockResolvedValue([
      storeRow("set", {
        storefront: storefront({
          logoUrl: "data:image/svg+xml;base64,AAAA",
          heroImageUrl: "https://x.public.blob.vercel-storage.com/cover.png",
        }),
      }),
      storeRow("cleared", { storefront: storefront({ logoUrl: "", heroImageUrl: "" }) }),
    ]);

    const result = await getStoreOverviews(owner);

    expect(result[0]).toMatchObject({
      logoUrl: "data:image/svg+xml;base64,AAAA",
      coverUrl: "https://x.public.blob.vercel-storage.com/cover.png",
    });
    expect(result[1]).toMatchObject({ logoUrl: null, coverUrl: null });
  });

  it("themeColor is the stored value as is (the client clamps it), whenever a storefront row exists", async () => {
    findMany.mockResolvedValue([
      storeRow("a", { storefront: storefront({ themeColor: "#000000" }) }),
    ]);

    const [row] = await getStoreOverviews(owner);

    expect(row.themeColor).toBe("#000000");
  });

  it("the linked-staff store gets its branding, currency and market even though it gets no stats", async () => {
    findMany.mockResolvedValue([
      storeRow("theirs", {
        businessId: "biz_other",
        financeSettings: { currency: "EUR", market: "FRANCE" },
        storefront: storefront({ tagline: "Chez nous", logoUrl: "https://l/logo.png" }),
      }),
    ]);

    const [row] = await getStoreOverviews({
      businessId: null,
      linkedStoreId: "theirs",
      includeTotals: true,
    });

    expect(row).toEqual({
      storeId: "theirs",
      tagline: "Chez nous",
      logoUrl: "https://l/logo.png",
      coverUrl: null,
      themeColor: "#FF6B35",
      currency: "EUR",
      market: "FRANCE",
      stats: null,
    });
  });
});
