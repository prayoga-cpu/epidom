import { describe, it, expect } from "vitest";
import {
  buildPaymentMethodRows,
  buildTenderPaymentMethodRows,
} from "@/lib/finance/report-aggregation";

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

/**
 * Multi-tender attribution (release 2.88.0). The route runs two groupBys over
 * the same order filter — tenders for orders that have `OrderPayment` rows,
 * whole-order method for the ones placed before them — and this merges the
 * results. Getting it wrong either double-counts a split bill or files it
 * under a "SPLIT" row nobody can act on.
 */
describe("buildTenderPaymentMethodRows", () => {
  it("attributes a split bill to the methods that actually took the money", () => {
    // One 100 bill: 40 cash + 60 card. Never a SPLIT row, never 100 twice.
    const rows = buildTenderPaymentMethodRows(
      [
        { method: "CASH", _sum: { amount: 40 }, _count: { id: 1 } },
        { method: "STRIPE_CARD", _sum: { amount: 60 }, _count: { id: 1 } },
      ],
      []
    );

    expect(rows.map((r) => r.paymentMethod)).toEqual(["STRIPE_CARD", "CASH"]);
    expect(rows.reduce((sum, r) => sum + r.revenue, 0)).toBe(100);
    expect(rows.some((r) => r.paymentMethod === "SPLIT")).toBe(false);
  });

  it("merges a legacy order with no tender rows into the same method bucket", () => {
    const rows = buildTenderPaymentMethodRows(
      [{ method: "CASH", _sum: { amount: 40 }, _count: { id: 1 } }],
      [{ paymentMethod: "CASH", _sum: { total: 60 }, _count: { id: 2 } }]
    );

    expect(rows).toEqual([
      { paymentMethod: "CASH", orderCount: 3, revenue: 100, percentOfTotal: 100 },
    ]);
  });

  it("keeps a legacy-only window byte-identical to the old single-groupBy result", () => {
    const legacy = [
      { paymentMethod: "CASH", _sum: { total: 750_000 }, _count: { id: 15 } },
      { paymentMethod: "QRIS", _sum: { total: 250_000 }, _count: { id: 5 } },
    ];
    expect(buildTenderPaymentMethodRows([], legacy)).toEqual(buildPaymentMethodRows(legacy));
  });

  it("accepts Prisma Decimal sums from either groupBy", () => {
    const decimal = (v: string) => ({ toString: () => v });
    const rows = buildTenderPaymentMethodRows(
      [{ method: "CASH", _sum: { amount: decimal("10.25") }, _count: { id: 1 } }],
      [{ paymentMethod: "CASH", _sum: { total: decimal("0.75") }, _count: { id: 1 } }]
    );
    expect(rows[0].revenue).toBe(11);
  });

  it("returns nothing for an empty window rather than a zero row", () => {
    expect(buildTenderPaymentMethodRows([], [])).toEqual([]);
  });

  it("still reports PAY_LATER, which never gets a tender row", () => {
    // An unpaid bill has no OrderPayment at all, so it arrives through the
    // legacy branch — dropping it would quietly hide unpaid revenue.
    const rows = buildTenderPaymentMethodRows(
      [{ method: "CASH", _sum: { amount: 100 }, _count: { id: 1 } }],
      [{ paymentMethod: "PAY_LATER", _sum: { total: 100 }, _count: { id: 1 } }]
    );
    expect(rows.map((r) => r.paymentMethod).sort()).toEqual(["CASH", "PAY_LATER"]);
  });
});
