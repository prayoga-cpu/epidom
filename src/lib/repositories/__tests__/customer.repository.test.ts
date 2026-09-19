import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { buildCustomerWhere, CustomerRepository, orderByFor } from "../customer.repository";

function makeDb() {
  const tx = {
    customer: { findFirst: vi.fn(), updateMany: vi.fn() },
    loyaltyEntry: { create: vi.fn() },
  };
  const db = {
    customer: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    order: { groupBy: vi.fn(), findMany: vi.fn() },
    loyaltyEntry: { aggregate: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { db, tx };
}

let ctx: ReturnType<typeof makeDb>;
let repo: CustomerRepository;

beforeEach(() => {
  ctx = makeDb();
  repo = new CustomerRepository(ctx.db as unknown as PrismaClient);
});

const row = (id: string) => ({ id, name: id });

describe("buildCustomerWhere", () => {
  it("always scopes to the store", () => {
    expect(buildCustomerWhere("s1")).toEqual({ storeId: "s1" });
    expect(buildCustomerWhere("s1", "   ")).toEqual({ storeId: "s1" });
  });

  it("matches name / phone / e-mail, and the national-format digits of a phone query", () => {
    const where = buildCustomerWhere("s1", "06 12 34 56 78");
    expect(where.storeId).toBe("s1");
    const or = JSON.stringify(where.OR);
    expect(or).toContain('"name"');
    expect(or).toContain('"email"');
    // The stored phone is E.164 (+33612345678); the trunk-0-less digits must be searched.
    expect(or).toContain('"contains":"612345678"');
  });

  it("does not add a digit clause for a plain-text query", () => {
    expect(buildCustomerWhere("s1", "ana").OR).toHaveLength(3);
  });
});

describe("orderByFor", () => {
  it("always ends in id so a cursor never skips or repeats a row", () => {
    for (const sort of ["name", "newest", "oldest", "points"] as const) {
      const order = orderByFor(sort);
      expect(order[order.length - 1]).toHaveProperty("id");
    }
  });
});

describe("findPage — cursor pagination", () => {
  it("asks for one extra row, and reports the last KEPT row as the next cursor", async () => {
    ctx.db.customer.findMany.mockResolvedValue([row("a"), row("b"), row("c")]);
    ctx.db.customer.count.mockResolvedValue(3);

    const page = await repo.findPage("s1", { limit: 2, sort: "name" });

    expect(ctx.db.customer.findMany.mock.calls[0][0]).toMatchObject({
      take: 3,
      where: { storeId: "s1" },
    });
    expect(page.customers.map((c) => c.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
    expect(page.totalCount).toBe(3);
  });

  it("has no next cursor on the last page", async () => {
    ctx.db.customer.findMany.mockResolvedValue([row("a")]);
    ctx.db.customer.count.mockResolvedValue(1);
    expect((await repo.findPage("s1", { limit: 2, sort: "name" })).nextCursor).toBeNull();
  });

  it("resumes after the cursor row (skip 1)", async () => {
    ctx.db.customer.findMany.mockResolvedValue([]);
    ctx.db.customer.count.mockResolvedValue(0);
    await repo.findPage("s1", { limit: 2, sort: "name", cursor: "b" });
    expect(ctx.db.customer.findMany.mock.calls[0][0]).toMatchObject({
      cursor: { id: "b" },
      skip: 1,
    });
  });
});

describe("aggregateOrders — computed per request, never cached", () => {
  it("does no query for an empty page", async () => {
    expect((await repo.aggregateOrders("s1", [])).size).toBe(0);
    expect(ctx.db.order.groupBy).not.toHaveBeenCalled();
  });

  it("groups by customer over REVENUE orders only, scoped to the store and the page's ids", async () => {
    ctx.db.order.groupBy.mockResolvedValue([]);
    await repo.aggregateOrders("s1", ["c1", "c2"]);

    const args = ctx.db.order.groupBy.mock.calls[0][0];
    expect(args.by).toEqual(["customerId"]);
    expect(args.where).toEqual({
      storeId: "s1",
      customerId: { in: ["c1", "c2"] },
      status: { notIn: NON_REVENUE_STATUSES },
    });
    // Cancelled and held orders are the excluded set — asserted, not assumed.
    expect(NON_REVENUE_STATUSES).toEqual(expect.arrayContaining(["CANCELLED", "HELD"]));
  });

  it("lifetimeSpend is Σ total − Σ refundAmount, rounded to cents", async () => {
    const lastAt = new Date("2026-09-01T10:00:00Z");
    ctx.db.order.groupBy.mockResolvedValue([
      {
        customerId: "c1",
        _sum: { total: 120.1, refundAmount: 20.05 },
        _count: { _all: 3 },
        _max: { orderDate: lastAt },
      },
      { customerId: null, _sum: { total: 9 }, _count: { _all: 1 }, _max: { orderDate: lastAt } },
    ]);

    const map = await repo.aggregateOrders("s1", ["c1", "c2"]);

    expect(map.get("c1")).toEqual({ lifetimeSpend: 100.05, orderCount: 3, lastOrderAt: lastAt });
    expect(map.has("c2")).toBe(false); // no orders => caller falls back to EMPTY_AGGREGATE
    expect(map.size).toBe(1); // the null-customer group is skipped
  });
});

describe("summary — store-wide tiles", () => {
  it("counts members, non-members and reports absolute points redeemed", async () => {
    ctx.db.customer.count.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => ("memberSince" in where ? 4 : 10)
    );
    ctx.db.loyaltyEntry.aggregate.mockResolvedValue({ _sum: { points: -350 } });

    expect(await repo.summary("s1")).toEqual({
      members: 4,
      nonMembers: 6,
      pointsRedeemedTotal: 350,
    });
    expect(ctx.db.loyaltyEntry.aggregate.mock.calls[0][0].where).toEqual({
      type: "REDEEM",
      customer: { storeId: "s1" },
    });
  });

  it("is zero, not NaN, for a store with no redemptions", async () => {
    ctx.db.customer.count.mockResolvedValue(0);
    ctx.db.loyaltyEntry.aggregate.mockResolvedValue({ _sum: { points: null } });
    expect(await repo.summary("s1")).toEqual({ members: 0, nonMembers: 0, pointsRedeemedTotal: 0 });
  });
});

describe("adjustPoints — one transaction, never below zero", () => {
  const found = (over: Record<string, unknown> = {}) => ({
    id: "c1",
    points: 100,
    memberSince: new Date("2026-01-01"),
    ...over,
  });

  it("is not_found for a customer of another store, and writes nothing", async () => {
    ctx.tx.customer.findFirst.mockResolvedValue(null);

    expect(await repo.adjustPoints("s1", "c-foreign", 10, "x")).toEqual({ kind: "not_found" });
    expect(ctx.tx.customer.findFirst.mock.calls[0][0].where).toEqual({
      id: "c-foreign",
      storeId: "s1",
    });
    expect(ctx.tx.customer.updateMany).not.toHaveBeenCalled();
    expect(ctx.tx.loyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("puts the balance floor INSIDE the update for a deduction (points >= amount removed)", async () => {
    ctx.tx.customer.findFirst
      .mockResolvedValueOnce(found())
      .mockResolvedValueOnce({ id: "c1", points: 70 });
    ctx.tx.customer.updateMany.mockResolvedValue({ count: 1 });

    const out = await repo.adjustPoints("s1", "c1", -30, "correction");

    const update = ctx.tx.customer.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: "c1", storeId: "s1", points: { gte: 30 } });
    expect(update.data).toEqual({ points: { increment: -30 } });
    expect(ctx.tx.loyaltyEntry.create).toHaveBeenCalledWith({
      data: { customerId: "c1", type: "ADJUST", points: -30, note: "correction" },
    });
    expect(out).toEqual({ kind: "ok", customer: { id: "c1", points: 70 } });
  });

  it("reports insufficient — and writes NO ledger row — when the guarded update matches nothing", async () => {
    ctx.tx.customer.findFirst.mockResolvedValue(found({ points: 10 }));
    ctx.tx.customer.updateMany.mockResolvedValue({ count: 0 });

    expect(await repo.adjustPoints("s1", "c1", -30, "x")).toEqual({
      kind: "insufficient",
      balance: 10,
    });
    expect(ctx.tx.loyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("a grant needs no floor, and stamps memberSince the first time", async () => {
    ctx.tx.customer.findFirst
      .mockResolvedValueOnce(found({ points: 0, memberSince: null }))
      .mockResolvedValueOnce({ id: "c1", points: 50 });
    ctx.tx.customer.updateMany.mockResolvedValue({ count: 1 });

    await repo.adjustPoints("s1", "c1", 50, "welcome");

    const update = ctx.tx.customer.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: "c1", storeId: "s1" });
    expect(update.data.points).toEqual({ increment: 50 });
    expect(update.data.memberSince).toBeInstanceOf(Date);
  });

  it("does not move an existing memberSince", async () => {
    ctx.tx.customer.findFirst.mockResolvedValueOnce(found()).mockResolvedValueOnce({ id: "c1" });
    ctx.tx.customer.updateMany.mockResolvedValue({ count: 1 });

    await repo.adjustPoints("s1", "c1", 5, "x");

    expect(ctx.tx.customer.updateMany.mock.calls[0][0].data).not.toHaveProperty("memberSince");
  });

  it("runs everything through a single $transaction", async () => {
    ctx.tx.customer.findFirst.mockResolvedValue(null);
    await repo.adjustPoints("s1", "c1", 1, "x");
    expect(ctx.db.$transaction).toHaveBeenCalledTimes(1);
  });
});
