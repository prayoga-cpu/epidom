import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * computeStoreFinanceSummary / deriveStoreSummary — the one P&L calculation
 * behind Finance's KPI cards and every row of the All outlets roll-up. The
 * pure arithmetic cases (gross/net profit, refunds, waste) live in
 * src/app/api/stores/[id]/finance/__tests__/summary.test.ts; this file covers
 * what the roll-up used to get wrong — currency conversion — and the query
 * scoping the loader applies.
 */

const prismaMock = vi.hoisted(() => ({
  order: { aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  wasteEntry: { aggregate: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const sumCogsBase = vi.fn();
vi.mock("@/lib/finance/cogs", () => ({
  sumCogsBase: (...a: unknown[]) => sumCogsBase(...a),
}));

const getOwnerCurrencyAndRate = vi.fn();
vi.mock("@/lib/services/storefront.service", () => ({
  storefrontService: {
    getOwnerCurrencyAndRate: (...a: unknown[]) => getOwnerCurrencyAndRate(...a),
    // The real pure conversion, so the test pins actual behaviour.
    convertBaseToOwnerSync: (amountInBase: number, rate: number) =>
      rate === 1 ? amountInBase : Math.round(amountInBase * rate * 100) / 100,
  },
}));

import {
  computeStoreFinanceSummary,
  deriveStoreSummary,
  refundedTaxPortion,
  type StoreSummaryInputs,
} from "../store-summary";

const NO_SALES: StoreSummaryInputs = {
  revenue: 0,
  orderCount: 0,
  taxCollected: 0,
  serviceCharge: 0,
  discountAmount: 0,
  refundAmount: 0,
  processingFee: 0,
  cogsBase: 0,
  unknownCostLines: 0,
  unknownCostRevenue: 0,
  wasteBase: 0,
};

describe("deriveStoreSummary — currency", () => {
  it("converts IDR costs (COGS, waste) into the store's currency but leaves Order money alone", () => {
    // A EUR store: revenue is already euros; 1,000,000 IDR of cost at 0.00006.
    const r = deriveStoreSummary(
      { ...NO_SALES, revenue: 100, cogsBase: 1_000_000, wasteBase: 100_000 },
      0.00006
    );

    expect(r.revenue).toBe(100);
    expect(r.cogs).toBe(60);
    expect(r.wasteLoss).toBe(6);
    expect(r.grossProfit).toBe(40);
    expect(r.netProfit).toBe(34);
  });

  it("never converts unknown-cost revenue — it comes from OrderItem.total, like revenue", () => {
    const r = deriveStoreSummary({ ...NO_SALES, unknownCostRevenue: 12.5 }, 0.00006);
    expect(r.unknownCostRevenue).toBe(12.5);
  });
});

describe("computeStoreFinanceSummary — loading", () => {
  const window = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-30T23:59:59Z") };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.aggregate
      .mockResolvedValueOnce({
        _sum: {
          total: 1000,
          subtotal: 900,
          tax: 100,
          serviceCharge: 0,
          discountAmount: 50,
          refundAmount: 20,
        },
        _count: { id: 10 },
      })
      .mockResolvedValueOnce({ _sum: { processingFee: 15 } })
      // Orders still waiting on payment.
      .mockResolvedValueOnce({ _sum: { total: 120 }, _count: { id: 2 } });
    prismaMock.order.groupBy.mockResolvedValue([
      { source: "POS", _sum: { total: 900 } },
      { source: "GOFOOD", _sum: { total: 100 } },
    ]);
    prismaMock.wasteEntry.aggregate.mockResolvedValue({ _sum: { totalValue: 30 } });
    sumCogsBase.mockResolvedValue({ cogsBase: 400, unknownCostLines: 1, unknownCostRevenue: 25 });
    getOwnerCurrencyAndRate.mockResolvedValue({ currency: "IDR", rate: 1 });
    prismaMock.order.findMany.mockResolvedValue([]);
  });

  it("returns the store's currency with every figure the Finance page shows", async () => {
    const r = await computeStoreFinanceSummary("store-1", window);

    expect(r.currency).toBe("IDR");
    expect(r).toMatchObject({
      revenue: 1000,
      grossRevenue: 1050,
      orderCount: 10,
      cogs: 400,
      // 1000 - 20 refund - 100 tax
      netSales: 880,
      // 880 - 400 cogs, measured on net sales
      grossProfit: 480,
      grossMarginPct: 54.55,
      wasteLoss: 30,
      taxCollected: 100,
      processingFee: 15,
      refundAmount: 20,
      // 880 - 15 fee
      netRevenue: 865,
      // GoFood keeps 20% of its 100
      platformCommission: 20,
      // 480 gross profit - 15 fee - 20 commission - 30 waste
      netProfit: 415,
      awaitingPaymentAmount: 120,
      awaitingPaymentCount: 2,
      unknownCostLines: 1,
      unknownCostRevenue: 25,
    });
  });

  it("scopes revenue, fees and COGS to the same orders, and fees to PAID ones only", async () => {
    const filters = { paymentMethod: "CASH" as const };
    await computeStoreFinanceSummary("store-1", window, filters);

    const [revenueCall, feeCall] = prismaMock.order.aggregate.mock.calls.map((c) => c[0].where);
    expect(revenueCall).toMatchObject({
      storeId: "store-1",
      orderDate: { gte: window.from, lte: window.to },
      paymentMethod: "CASH",
    });
    expect(revenueCall.status.notIn).toEqual(expect.arrayContaining(["CANCELLED", "HELD"]));
    expect(feeCall).toMatchObject({ ...revenueCall, paymentStatus: "PAID" });
    expect(sumCogsBase).toHaveBeenCalledWith(revenueCall);
  });

  it("takes the tax share of a refund back out of the tax owed", async () => {
    // The 20 refunded came off a 220 order carrying 20 tax: 20 * 20 / 220.
    prismaMock.order.findMany.mockResolvedValue([{ total: 220, tax: 20, refundAmount: 20 }]);

    const r = await computeStoreFinanceSummary("store-1", window);

    expect(prismaMock.order.findMany.mock.calls[0][0].where).toMatchObject({
      storeId: "store-1",
      refundAmount: { gt: 0 },
    });
    expect(r.taxCollected).toBe(98.18);
    expect(r.netSales).toBe(881.82);
  });

  it("scopes waste by store and date only — it has no order to filter by", async () => {
    await computeStoreFinanceSummary("store-1", window, { paymentMethod: "CASH" as const });

    expect(prismaMock.wasteEntry.aggregate.mock.calls[0][0].where).toEqual({
      storeId: "store-1",
      createdAt: { gte: window.from, lte: window.to },
    });
  });
});

describe("refundedTaxPortion", () => {
  it("is the refund's proportional share of the order's tax", () => {
    expect(refundedTaxPortion({ total: 110, tax: 10, refundAmount: 55 })).toBe(5);
  });

  it("gives back all the tax on a full refund", () => {
    expect(refundedTaxPortion({ total: 110, tax: 10, refundAmount: 110 })).toBe(10);
  });

  it("is zero with no refund, no tax, or a zero total", () => {
    expect(refundedTaxPortion({ total: 110, tax: 10, refundAmount: 0 })).toBe(0);
    expect(refundedTaxPortion({ total: 100, tax: 0, refundAmount: 50 })).toBe(0);
    expect(refundedTaxPortion({ total: 0, tax: 0, refundAmount: 0 })).toBe(0);
  });

  it("never gives back more tax than the order carried", () => {
    expect(refundedTaxPortion({ total: 110, tax: 10, refundAmount: 500 })).toBe(10);
  });
});

describe("deriveStoreSummary — the P&L statement adds up", () => {
  const SALE: StoreSummaryInputs = {
    ...NO_SALES,
    revenue: 1_234.56,
    orderCount: 7,
    discountAmount: 45.67,
    refundAmount: 110,
    taxCollected: 112.23,
    refundedTax: 10,
    processingFee: 18.91,
    cogsBase: 333.33,
    wasteBase: 21.09,
    platformCommission: 12.34,
  };

  it("foots line by line, to the cent", () => {
    const r = deriveStoreSummary(SALE, 1);
    const cents = (n: number) => Math.round(n * 100);

    expect(cents(r.grossRevenue) - cents(r.discountAmount)).toBe(cents(r.revenue));
    expect(cents(r.revenue) - cents(r.refundAmount) - cents(r.taxCollected)).toBe(
      cents(r.netSales)
    );
    expect(cents(r.netSales) - cents(r.cogs)).toBe(cents(r.grossProfit));
    expect(
      cents(r.grossProfit) -
        cents(r.processingFee) -
        cents(r.platformCommission) -
        cents(r.wasteLoss)
    ).toBe(cents(r.netProfit));
    expect(cents(r.netSales) - cents(r.processingFee)).toBe(cents(r.netRevenue));
  });

  it("measures gross profit on net sales, so tax collected is never counted as profit", () => {
    // 111 charged = 100 sale + 11 tax, costing 40.
    const r = deriveStoreSummary({ ...NO_SALES, revenue: 111, taxCollected: 11, cogsBase: 40 }, 1);
    expect(r.netSales).toBe(100);
    expect(r.grossProfit).toBe(60);
    expect(r.grossMarginPct).toBe(60);
  });

  it("does not take the tax off a fully refunded sale twice", () => {
    // One 110 sale (10 tax), refunded in full: nothing sold, nothing owed.
    const r = deriveStoreSummary(
      { ...NO_SALES, revenue: 110, taxCollected: 10, refundAmount: 110, refundedTax: 10 },
      1
    );
    expect(r.taxCollected).toBe(0);
    expect(r.netSales).toBe(0);
    expect(r.netProfit).toBe(0);
  });
});
