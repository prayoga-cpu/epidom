import { describe, it, expect } from "vitest";
import { buildItemMarginRows } from "@/lib/finance/report-aggregation";

describe("buildItemMarginRows", () => {
  it("computes revenue, cost, margin, and margin% for a fully-costed item", () => {
    const rows = buildItemMarginRows([
      { name: "Nasi Goreng", quantity: 2, total: 60_000, unitCostSnapshot: 15_000 },
    ]);
    expect(rows[0]).toMatchObject({
      name: "Nasi Goreng",
      orderCount: 1,
      totalQuantity: 2,
      totalRevenue: 60_000,
      totalCost: 30_000, // 15,000 x 2
      margin: 30_000,
      marginPct: 50,
    });
  });

  it("sums multiple lines of the same item into one bucket", () => {
    const rows = buildItemMarginRows([
      { name: "Es Teh", quantity: 1, total: 10_000, unitCostSnapshot: 2_000 },
      { name: "Es Teh", quantity: 3, total: 30_000, unitCostSnapshot: 2_000 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderCount: 2,
      totalQuantity: 4,
      totalRevenue: 40_000,
      totalCost: 8_000,
      margin: 32_000,
    });
  });

  it("reports cost/margin as null (unknown) when any line lacks a cost snapshot", () => {
    const rows = buildItemMarginRows([
      { name: "Ayam Bakar", quantity: 1, total: 25_000, unitCostSnapshot: 10_000 },
      { name: "Ayam Bakar", quantity: 1, total: 25_000, unitCostSnapshot: null },
    ]);
    expect(rows[0]).toMatchObject({
      totalRevenue: 50_000,
      totalCost: null,
      margin: null,
      marginPct: null,
    });
  });

  it("sorts by margin descending, with unknown-margin items last", () => {
    const rows = buildItemMarginRows([
      { name: "Low Margin", quantity: 1, total: 10_000, unitCostSnapshot: 9_000 },
      { name: "High Margin", quantity: 1, total: 10_000, unitCostSnapshot: 1_000 },
      { name: "Unknown Margin", quantity: 1, total: 10_000, unitCostSnapshot: null },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["High Margin", "Low Margin", "Unknown Margin"]);
  });
});
