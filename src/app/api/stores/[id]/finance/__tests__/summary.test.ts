import { describe, it, expect } from "vitest";

/**
 * Pure logic tests for finance summary calculations.
 * These do not touch the DB — they verify the formulas used in the route.
 */

// Inline the formulas from summary/route.ts so they can be tested in isolation
function calcSummary(revenue: number, cogsMovements: { quantity: number; unitCost: number }[]) {
  const cogs = cogsMovements.reduce((sum, m) => {
    const qty = Math.abs(m.quantity);
    const cost = m.unitCost;
    return sum + qty * cost;
  }, 0);

  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    revenue,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPct: Math.round(grossMargin * 100) / 100,
  };
}

describe("finance summary calculations", () => {
  it("returns zero COGS and zero margin when no stock movements", () => {
    const result = calcSummary(500_000, []);
    expect(result.cogs).toBe(0);
    expect(result.grossProfit).toBe(500_000);
    expect(result.grossMarginPct).toBe(100);
  });

  it("correctly computes COGS from stock movements", () => {
    const result = calcSummary(500_000, [
      { quantity: 2, unitCost: 50_000 },  // 100k
      { quantity: 1, unitCost: 30_000 },  // 30k
    ]);
    expect(result.cogs).toBe(130_000);
    expect(result.grossProfit).toBe(370_000);
    expect(result.grossMarginPct).toBe(74);
  });

  it("handles negative quantities (SALE movements use absolute value)", () => {
    const result = calcSummary(200_000, [
      { quantity: -3, unitCost: 20_000 }, // abs → 3 * 20k = 60k
    ]);
    expect(result.cogs).toBe(60_000);
    expect(result.grossProfit).toBe(140_000);
  });

  it("returns 0% margin when revenue is zero (no division-by-zero)", () => {
    const result = calcSummary(0, [{ quantity: 1, unitCost: 10_000 }]);
    expect(result.grossMarginPct).toBe(0);
  });

  it("rounds COGS and grossProfit to 2 decimal places", () => {
    // 3 * 333.333... = 999.999...
    const result = calcSummary(10_000, [{ quantity: 3, unitCost: 333.333 }]);
    expect(result.cogs).toBe(1000.0); // rounds correctly
    expect(Number.isInteger(result.cogs * 100)).toBe(true);
  });

  it("gross profit = revenue - COGS always", () => {
    const movements = [
      { quantity: 5, unitCost: 15_000 },
      { quantity: 2, unitCost: 8_000 },
    ];
    const result = calcSummary(300_000, movements);
    expect(result.grossProfit).toBeCloseTo(result.revenue - result.cogs, 2);
  });

  it("100% COGS results in 0 gross profit", () => {
    const result = calcSummary(100_000, [{ quantity: 1, unitCost: 100_000 }]);
    expect(result.grossProfit).toBe(0);
    expect(result.grossMarginPct).toBe(0);
  });
});
