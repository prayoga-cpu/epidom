import { describe, it, expect } from "vitest";
import { buildPaymentMethodRows } from "@/lib/finance/report-aggregation";

describe("buildPaymentMethodRows", () => {
  it("computes revenue, order count, and share of total per method", () => {
    const rows = buildPaymentMethodRows([
      { paymentMethod: "CASH", _sum: { total: 750_000 }, _count: { id: 15 } },
      { paymentMethod: "QRIS", _sum: { total: 250_000 }, _count: { id: 5 } },
    ]);

    expect(rows).toEqual([
      { paymentMethod: "CASH", orderCount: 15, revenue: 750_000, percentOfTotal: 75 },
      { paymentMethod: "QRIS", orderCount: 5, revenue: 250_000, percentOfTotal: 25 },
    ]);
  });

  it("sorts by revenue descending regardless of input order", () => {
    const rows = buildPaymentMethodRows([
      { paymentMethod: "GOPAY", _sum: { total: 10_000 }, _count: { id: 1 } },
      { paymentMethod: "CASH", _sum: { total: 90_000 }, _count: { id: 9 } },
    ]);
    expect(rows.map((r) => r.paymentMethod)).toEqual(["CASH", "GOPAY"]);
  });

  it("defaults a null sum to 0 revenue and 0% share", () => {
    const rows = buildPaymentMethodRows([
      { paymentMethod: "CASH", _sum: { total: null }, _count: { id: 0 } },
    ]);
    expect(rows[0]).toMatchObject({ revenue: 0, percentOfTotal: 0 });
  });

  it("percentOfTotal is 0 for every row when total revenue is 0 (avoids division by zero)", () => {
    const rows = buildPaymentMethodRows([
      { paymentMethod: "CASH", _sum: { total: 0 }, _count: { id: 0 } },
      { paymentMethod: "QRIS", _sum: { total: 0 }, _count: { id: 0 } },
    ]);
    expect(rows.every((r) => r.percentOfTotal === 0)).toBe(true);
  });
});
