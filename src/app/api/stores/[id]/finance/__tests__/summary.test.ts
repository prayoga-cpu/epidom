import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the finance summary route's cost side.
 *
 * This file used to inline its own reimplementation of the COGS formula and
 * assert against that copy — so it exercised no production code at all and
 * would have stayed green through any change to how COGS is actually computed
 * (it did: three production copies of the formula drifted apart underneath it).
 * The formula now lives in ONE place, `src/lib/finance/cogs.ts`, and that is
 * what is tested here.
 *
 * The arithmetic the route still does inline on top of COGS (gross/net profit)
 * has no extractable helper, so it is mirrored below — clearly labelled, and
 * driven by a real `sumCogsBase` result rather than a hand-made number.
 */

// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.
var prismaMock: any;
var capturedQueries: { text: string; values: any[] }[];

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    order: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { prisma: prismaMock };
});

import { sumCogsBase, sumCogsBaseByStore } from "@/lib/finance/cogs";

/** The literal SQL of a `Prisma.sql` template, parameters elided. */
function sqlText(query: any): string {
  return query.strings.join(" ? ");
}

/**
 * Route `$queryRaw` to the right canned aggregate by which table it reads.
 * The legacy query mentions `order_items` inside its NOT EXISTS guard, so it
 * must be matched on `stock_movements` first.
 */
function answerWith({ snapshot, legacy }: { snapshot?: any[]; legacy?: any[] }) {
  return async (query: any) => {
    const text = sqlText(query);
    capturedQueries.push({ text, values: query.values });
    if (text.includes('FROM "stock_movements"')) return legacy ?? [{ cogs: 0 }];
    if (text.includes('FROM "order_items"')) {
      return snapshot ?? [{ cogs: 0, unknown_lines: 0, unknown_revenue: 0 }];
    }
    throw new Error(`unexpected query: ${text}`);
  };
}

const snapshotQuery = () =>
  capturedQueries.find((q) => !q.text.includes('FROM "stock_movements"'))!;
const legacyQuery = () => capturedQueries.find((q) => q.text.includes('FROM "stock_movements"'))!;

describe("sumCogsBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueries = [];
  });

  it("returns zeros and issues no aggregate query for a window with no orders", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);

    const result = await sumCogsBase({ storeId: "store-1" });

    expect(result).toEqual({ cogsBase: 0, unknownCostLines: 0, unknownCostRevenue: 0 });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("passes the caller's order filter through untouched, so shift/channel/payment scoping matches revenue", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    const where = {
      storeId: "store-1",
      status: { notIn: ["CANCELLED"] },
      orderDate: { gte: new Date("2026-08-01"), lte: new Date("2026-08-31") },
    };

    await sumCogsBase(where as any);

    expect(prismaMock.order.findMany).toHaveBeenCalledWith({ where, select: { id: true } });
  });

  it("costs an order WITH snapshots from the frozen per-line snapshots", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-snap" }]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [{ cogs: 130_000, unknown_lines: 0, unknown_revenue: 0 }],
        // The order has a snapshot, so the legacy guard excludes it entirely.
        legacy: [{ cogs: 0 }],
      })
    );

    const result = await sumCogsBase({ storeId: "store-1" });

    expect(result.cogsBase).toBe(130_000);
    expect(result.unknownCostLines).toBe(0);
  });

  it("falls back to the legacy material-SALE ledger for an order with NO snapshot anywhere", async () => {
    // unitCostSnapshot was added nullable and never backfilled. A naive `?? 0`
    // would rewrite every pre-snapshot window to zero COGS / 100% margin.
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-legacy" }]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [{ cogs: 0, unknown_lines: 2, unknown_revenue: 200_000 }],
        legacy: [{ cogs: 60_000 }],
      })
    );

    const result = await sumCogsBase({ storeId: "store-1" });

    expect(result.cogsBase).toBe(60_000);
    expect(result.unknownCostLines).toBe(2);
    expect(result.unknownCostRevenue).toBe(200_000);
  });

  it("adds the two sources together across a mixed window", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-snap" }, { id: "order-legacy" }]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [{ cogs: 130_000, unknown_lines: 1, unknown_revenue: 50_000 }],
        legacy: [{ cogs: 60_000 }],
      })
    );

    const result = await sumCogsBase({ storeId: "store-1" });

    expect(result.cogsBase).toBe(190_000);
  });

  it("scopes BOTH aggregates to exactly the orders in the window", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-a" }, { id: "order-b" }]);
    prismaMock.$queryRaw.mockImplementation(answerWith({}));

    await sumCogsBase({ storeId: "store-1" });

    expect(capturedQueries).toHaveLength(2);
    expect(snapshotQuery().values).toEqual([["order-a", "order-b"]]);
    expect(legacyQuery().values).toEqual([["order-a", "order-b"]]);
  });

  it("never lets the two sources double-count the same order", async () => {
    // The disjointness is enforced in SQL: the legacy term is correlated to
    // sm.\"orderId\" and drops any order that has even one snapshotted line.
    // Pin the guard, because losing it silently doubles COGS for every order
    // that has both a snapshot and modifier material movements — which is most
    // of them.
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-a" }]);
    prismaMock.$queryRaw.mockImplementation(answerWith({}));

    await sumCogsBase({ storeId: "store-1" });

    const legacy = legacyQuery().text.replace(/\s+/g, " ");
    expect(legacy).toContain("NOT EXISTS");
    expect(legacy).toContain('FROM "order_items" oi WHERE oi."orderId" = sm."orderId"');
    expect(legacy).toContain('oi."unitCostSnapshot" IS NOT NULL');
    // ...and the legacy term reads the material ledger only, never product SALE rows.
    expect(legacy).toContain('JOIN "ingredients" m ON m."id" = sm."materialId"');
    expect(legacy).toContain("sm.\"type\" = 'SALE'");
  });

  it("counts lines with no cost source instead of silently zeroing them", async () => {
    // Aggregator orders write OrderItems with neither menuItemId nor productId:
    // they can never acquire a snapshot and never produced a material movement.
    // Their cost is unknown, not zero — reporting 0 implies 100% margin.
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-aggregator" }]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [{ cogs: 0, unknown_lines: 3, unknown_revenue: 450_000 }],
        legacy: [{ cogs: 0 }],
      })
    );

    const result = await sumCogsBase({ storeId: "store-1" });

    expect(result.cogsBase).toBe(0);
    expect(result.unknownCostLines).toBe(3);
    expect(result.unknownCostRevenue).toBe(450_000);
  });

  it("sums the snapshot term as quantity x (unit cost + modifier cost)", async () => {
    // Modifier materials are the only material SALE rows most stores write, so
    // dropping optionCostSnapshot from the snapshot term deletes them from the
    // P&L entirely.
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-a" }]);
    prismaMock.$queryRaw.mockImplementation(answerWith({}));

    await sumCogsBase({ storeId: "store-1" });

    const snapshot = snapshotQuery().text.replace(/\s+/g, " ");
    expect(snapshot).toContain(
      'oi."quantity" * (oi."unitCostSnapshot" + COALESCE(oi."optionCostSnapshot", 0))'
    );
    // NULL snapshots contribute 0 to cogs and 1 to unknown_lines — never both.
    expect(snapshot).toContain('CASE WHEN oi."unitCostSnapshot" IS NOT NULL');
    expect(snapshot).toContain('COUNT(*) FILTER (WHERE oi."unitCostSnapshot" IS NULL)');
  });

  it("is NOT filtered by OrderItem.status — a line cancelled post-delivery keeps its cost", async () => {
    // Cancelling a line does not recompute Order.total, so dropping its cost
    // while its revenue stays would jump a 60% gross margin to 76% on a
    // manager's late correction.
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-a" }]);
    prismaMock.$queryRaw.mockImplementation(answerWith({}));

    await sumCogsBase({ storeId: "store-1" });

    expect(snapshotQuery().text).not.toContain('oi."status"');
  });

  it("tolerates an empty aggregate result rather than returning NaN", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-a" }]);
    prismaMock.$queryRaw.mockResolvedValue([]);

    const result = await sumCogsBase({ storeId: "store-1" });

    expect(result).toEqual({ cogsBase: 0, unknownCostLines: 0, unknownCostRevenue: 0 });
  });
});

describe("sumCogsBaseByStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueries = [];
  });

  it("returns an empty map for a window with no orders, without querying", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    const byStore = await sumCogsBaseByStore({});
    expect(byStore.size).toBe(0);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("attributes each order's cost to its own store", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: "order-a", storeId: "store-1" },
      { id: "order-b", storeId: "store-1" },
      { id: "order-c", storeId: "store-2" },
    ]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [
          { orderId: "order-a", cogs: 10_000, unknown_lines: 0, unknown_revenue: 0 },
          { orderId: "order-b", cogs: 5_000, unknown_lines: 2, unknown_revenue: 30_000 },
          { orderId: "order-c", cogs: 7_000, unknown_lines: 0, unknown_revenue: 0 },
        ],
        legacy: [],
      })
    );

    const byStore = await sumCogsBaseByStore({});

    expect(byStore.get("store-1")).toEqual({
      cogsBase: 15_000,
      unknownCostLines: 2,
      unknownCostRevenue: 30_000,
    });
    expect(byStore.get("store-2")).toEqual({
      cogsBase: 7_000,
      unknownCostLines: 0,
      unknownCostRevenue: 0,
    });
  });

  it("folds legacy-ledger cost into the same store bucket as its snapshot cost", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: "order-snap", storeId: "store-1" },
      { id: "order-legacy", storeId: "store-1" },
    ]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [{ orderId: "order-snap", cogs: 10_000, unknown_lines: 0, unknown_revenue: 0 }],
        legacy: [{ orderId: "order-legacy", cogs: 4_000 }],
      })
    );

    const byStore = await sumCogsBaseByStore({});

    expect(byStore.get("store-1")!.cogsBase).toBe(14_000);
  });
});

describe("gross/net profit arithmetic (mirrors summary/route.ts — no extractable helper)", () => {
  // route.ts: grossProfit = revenue - cogs; grossMargin guards revenue === 0.
  function calcGross(revenue: number, cogs: number) {
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    return {
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPct: Math.round(grossMargin * 100) / 100,
    };
  }

  // route.ts: netRevenue strips tax, processing fee and refunds; netProfit
  // further strips COGS and waste loss.
  function calcNet(
    revenue: number,
    taxCollected: number,
    processingFee: number,
    cogs: number,
    wasteLoss: number = 0,
    refundAmount: number = 0
  ) {
    const netRevenue = revenue - refundAmount - taxCollected - processingFee;
    const netProfit = netRevenue - cogs - wasteLoss;
    return {
      netRevenue: Math.round(netRevenue * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueries = [];
  });

  it("derives gross profit and margin from a REAL sumCogsBase result", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-a" }]);
    prismaMock.$queryRaw.mockImplementation(
      answerWith({
        snapshot: [{ cogs: 100_000, unknown_lines: 0, unknown_revenue: 0 }],
        legacy: [{ cogs: 30_000 }],
      })
    );

    const { cogsBase } = await sumCogsBase({ storeId: "store-1" });
    const result = calcGross(500_000, cogsBase);

    expect(result.cogs).toBe(130_000);
    expect(result.grossProfit).toBe(370_000);
    expect(result.grossMarginPct).toBe(74);
  });

  it("returns 0% margin when revenue is zero (no division-by-zero)", () => {
    expect(calcGross(0, 10_000).grossMarginPct).toBe(0);
  });

  it("100% COGS results in 0 gross profit", () => {
    const result = calcGross(100_000, 100_000);
    expect(result.grossProfit).toBe(0);
    expect(result.grossMarginPct).toBe(0);
  });

  it("netRevenue = revenue when no tax or fees were charged", () => {
    expect(calcNet(500_000, 0, 0, 0).netRevenue).toBe(500_000);
  });

  it("subtracts tax collected and processing fee from revenue", () => {
    const result = calcNet(1_116_550, 116_550, 7_781.85, 0);
    expect(result.netRevenue).toBe(992_218.15);
  });

  it("netProfit further subtracts COGS from netRevenue", () => {
    const result = calcNet(1_000_000, 100_000, 7_000, 300_000);
    expect(result.netRevenue).toBe(893_000);
    expect(result.netProfit).toBe(593_000);
  });

  it("tax is excluded from net revenue even though it's included in gross revenue", () => {
    // revenue always equals Σ Order.total (unchanged), tax is carved back out here
    const revenue = 111_000; // 100,000 + 11,000 tax
    expect(calcNet(revenue, 11_000, 0, 0).netRevenue).toBe(100_000);
  });

  it("netProfit further subtracts waste loss on top of COGS", () => {
    const result = calcNet(1_000_000, 100_000, 7_000, 300_000, 50_000);
    expect(result.netRevenue).toBe(893_000); // unaffected by waste
    expect(result.netProfit).toBe(543_000); // 593,000 - 50,000
  });

  it("waste loss does not affect netRevenue, only netProfit", () => {
    const withoutWaste = calcNet(500_000, 0, 0, 0, 0);
    const withWaste = calcNet(500_000, 0, 0, 0, 25_000);
    expect(withWaste.netRevenue).toBe(withoutWaste.netRevenue);
    expect(withWaste.netProfit).toBe(withoutWaste.netProfit - 25_000);
  });

  it("subtracts refundAmount from netRevenue (money that left the business)", () => {
    expect(calcNet(500_000, 0, 0, 0, 0, 50_000).netRevenue).toBe(450_000);
  });

  it("refunds flow through to netProfit alongside COGS/waste", () => {
    const result = calcNet(500_000, 0, 0, 100_000, 10_000, 50_000);
    // 500,000 - 50,000 refund - 100,000 cogs - 10,000 waste
    expect(result.netProfit).toBe(340_000);
  });

  it("no refund (default) matches pre-refund-tracking behavior exactly", () => {
    const withRefundParam = calcNet(500_000, 10_000, 5_000, 50_000, 1_000, 0);
    const withoutRefundParam = calcNet(500_000, 10_000, 5_000, 50_000, 1_000);
    expect(withRefundParam).toEqual(withoutRefundParam);
  });
});

describe("grossRevenue (P&L statement view)", () => {
  // Inline from summary/route.ts: total is already post-discount, so
  // grossRevenue backs the pre-discount figure out rather than being an
  // independently-summed value.
  function calcGrossRevenue(revenue: number, discountAmount: number) {
    return Math.round((revenue + discountAmount) * 100) / 100;
  }

  it("equals revenue when no discount was applied", () => {
    expect(calcGrossRevenue(500_000, 0)).toBe(500_000);
  });

  it("adds the discount back on top of the (already-discounted) revenue", () => {
    expect(calcGrossRevenue(80_000, 20_000)).toBe(100_000);
  });
});
