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
  order: { aggregate: vi.fn() },
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
      .mockResolvedValueOnce({ _sum: { processingFee: 15 } });
    prismaMock.wasteEntry.aggregate.mockResolvedValue({ _sum: { totalValue: 30 } });
    sumCogsBase.mockResolvedValue({ cogsBase: 400, unknownCostLines: 1, unknownCostRevenue: 25 });
    getOwnerCurrencyAndRate.mockResolvedValue({ currency: "IDR", rate: 1 });
  });

  it("returns the store's currency with every figure the Finance page shows", async () => {
    const r = await computeStoreFinanceSummary("store-1", window);

    expect(r.currency).toBe("IDR");
    expect(r).toMatchObject({
      revenue: 1000,
      grossRevenue: 1050,
      orderCount: 10,
      cogs: 400,
      grossProfit: 600,
      grossMarginPct: 60,
      wasteLoss: 30,
      taxCollected: 100,
      processingFee: 15,
      refundAmount: 20,
      // 1000 - 20 refund - 100 tax - 15 fee
      netRevenue: 865,
      // 865 - 400 cogs - 30 waste
      netProfit: 435,
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

  it("scopes waste by store and date only — it has no order to filter by", async () => {
    await computeStoreFinanceSummary("store-1", window, { paymentMethod: "CASH" as const });

    expect(prismaMock.wasteEntry.aggregate.mock.calls[0][0].where).toEqual({
      storeId: "store-1",
      createdAt: { gte: window.from, lte: window.to },
    });
  });
});
