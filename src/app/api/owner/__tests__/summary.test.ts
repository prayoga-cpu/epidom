import { describe, it, expect } from "vitest";

/**
 * Pure logic tests for owner dashboard rollup calculations.
 * Mirrors the aggregation in /api/owner/summary/route.ts.
 */

type StoreMetric = {
  storeId: string;
  name: string;
  image: string | null;
  revenue: number;
  orderCount: number;
  pendingOrders: number;
};

function rollup(stores: StoreMetric[]) {
  const sorted = [...stores].sort((a, b) => b.revenue - a.revenue);
  return {
    totalRevenue: Math.round(stores.reduce((s, m) => s + m.revenue, 0) * 100) / 100,
    totalOrders: stores.reduce((s, m) => s + m.orderCount, 0),
    totalPending: stores.reduce((s, m) => s + m.pendingOrders, 0),
    storeCount: stores.length,
    stores: sorted,
  };
}

const makeStore = (id: string, revenue: number, orders: number, pending: number): StoreMetric => ({
  storeId: id,
  name: `Store ${id}`,
  image: null,
  revenue,
  orderCount: orders,
  pendingOrders: pending,
});

describe("owner dashboard rollup", () => {
  it("sums revenue, orders, and pending across all stores", () => {
    const result = rollup([
      makeStore("A", 1_000_000, 10, 2),
      makeStore("B", 500_000, 5, 1),
      makeStore("C", 250_000, 3, 0),
    ]);
    expect(result.totalRevenue).toBe(1_750_000);
    expect(result.totalOrders).toBe(18);
    expect(result.totalPending).toBe(3);
    expect(result.storeCount).toBe(3);
  });

  it("sorts stores by revenue descending", () => {
    const result = rollup([
      makeStore("low", 100_000, 1, 0),
      makeStore("high", 900_000, 9, 0),
      makeStore("mid", 500_000, 5, 0),
    ]);
    expect(result.stores[0].storeId).toBe("high");
    expect(result.stores[1].storeId).toBe("mid");
    expect(result.stores[2].storeId).toBe("low");
  });

  it("returns zeros for empty store list", () => {
    const result = rollup([]);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalOrders).toBe(0);
    expect(result.totalPending).toBe(0);
    expect(result.storeCount).toBe(0);
    expect(result.stores).toHaveLength(0);
  });

  it("handles a single store correctly", () => {
    const result = rollup([makeStore("only", 999_000, 7, 3)]);
    expect(result.totalRevenue).toBe(999_000);
    expect(result.storeCount).toBe(1);
    expect(result.stores[0].storeId).toBe("only");
  });

  it("rounds totalRevenue to 2 decimal places", () => {
    const result = rollup([
      makeStore("A", 333.333, 1, 0),
      makeStore("B", 333.333, 1, 0),
      makeStore("C", 333.334, 1, 0),
    ]);
    expect(result.totalRevenue).toBe(1000);
    expect(Number.isInteger(result.totalRevenue * 100)).toBe(true);
  });

  it("pending orders are not filtered by date range (current status only)", () => {
    // pending is a live count, independent of revenue date range
    const result = rollup([makeStore("X", 0, 0, 5)]);
    expect(result.totalPending).toBe(5);
    expect(result.totalOrders).toBe(0); // no orders in date range
  });
});

describe("ENTERPRISE plan gating logic", () => {
  const PLAN_ORDER = ["FREE", "POS", "OPERATIONS", "ENTERPRISE"] as const;
  type Plan = (typeof PLAN_ORDER)[number];

  function hasEnterpriseAccess(plan: Plan): boolean {
    return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf("ENTERPRISE");
  }

  it("only ENTERPRISE plan passes the gate", () => {
    expect(hasEnterpriseAccess("ENTERPRISE")).toBe(true);
  });

  it.each(["FREE", "POS", "OPERATIONS"] as Plan[])(
    "%s plan is rejected (returns false)",
    (plan) => {
      expect(hasEnterpriseAccess(plan)).toBe(false);
    }
  );
});
