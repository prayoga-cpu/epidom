import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { sumCogsBase } from "@/lib/finance/cogs";
import { storefrontService } from "@/lib/services/storefront.service";

/**
 * One store's P&L for a window — the numbers behind Finance's KPI cards and
 * P&L statement, and each row of the All outlets roll-up. Both call
 * computeStoreFinanceSummary, so an outlet's row in the roll-up is the same
 * figure its own Finance page shows for the same dates. (The roll-up used to
 * carry its own copy of this arithmetic, which dropped refunds, tax and card
 * fees from net profit and converted costs into the wrong currency.)
 */

/** The raw sums a summary is derived from. Money from Order columns is in the
 * store's own currency; `cogsBase`/`wasteBase` are IDR (Material.unitCost,
 * WasteEntry.totalValue) and still need converting. */
export interface StoreSummaryInputs {
  revenue: number;
  orderCount: number;
  taxCollected: number;
  serviceCharge: number;
  discountAmount: number;
  refundAmount: number;
  processingFee: number;
  cogsBase: number;
  unknownCostLines: number;
  unknownCostRevenue: number;
  wasteBase: number;
}

export interface StoreFinanceSummary {
  /** Unrounded, like the route always returned it. */
  revenue: number;
  grossRevenue: number;
  discountAmount: number;
  refundAmount: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  unknownCostLines: number;
  unknownCostRevenue: number;
  wasteLoss: number;
  taxCollected: number;
  serviceCharge: number;
  processingFee: number;
  netRevenue: number;
  netProfit: number;
  orderCount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Pure: turns the raw sums into the reported figures. `rate` converts IDR
 * into the store's currency (1 for an IDR store).
 */
export function deriveStoreSummary(inputs: StoreSummaryInputs, rate: number): StoreFinanceSummary {
  const { revenue, taxCollected, refundAmount, processingFee, discountAmount } = inputs;

  // revenue (and everything derived from Order.total) is already a literal
  // value in the store's own currency; cogs comes from Material.unitCost,
  // stored in IDR (the platform base currency). Mixing them in
  // `revenue - cogs` without converting first produces a nonsensical figure
  // for any non-IDR store — convert cogs (and waste loss) before combining.
  const cogs = storefrontService.convertBaseToOwnerSync(inputs.cogsBase, rate);
  // Waste loss (expired/damaged/spoiled/... inventory) is shrinkage, not
  // cost-of-goods-sold for items that actually sold, so it's kept out of
  // cogs/grossProfit and only reduces the netProfit bottom line.
  const wasteLoss = storefrontService.convertBaseToOwnerSync(inputs.wasteBase, rate);

  // `total` is already post-discount (computeOrderCharges applies the
  // discount before subtotal/tax/total are derived) — grossRevenue backs the
  // pre-discount figure out for the P&L statement, it is not an independent
  // sum.
  const grossRevenue = revenue + discountAmount;
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // netRevenue excludes tax (it's the government's, not the business's), the
  // payment-processing fee (the provider's cut), and any refunds issued (money
  // that left the business). netProfit further subtracts COGS and waste loss.
  // Refunds are attributed to the original order's orderDate (accrual-style,
  // not the later refundedAt) — every other figure here is scoped that way.
  const netRevenue = revenue - refundAmount - taxCollected - processingFee;
  const netProfit = netRevenue - cogs - wasteLoss;

  return {
    revenue,
    grossRevenue: round2(grossRevenue),
    discountAmount: round2(discountAmount),
    refundAmount: round2(refundAmount),
    cogs: round2(cogs),
    grossProfit: round2(grossProfit),
    grossMarginPct: round2(grossMargin),
    // Lines with no cost source at all (aggregator orders can never acquire
    // one). Surfaced so the UI can annotate the figure instead of implying
    // these sold at 100% margin. NOT converted: derived from OrderItem.total,
    // which — like revenue — is already in the store's own currency.
    unknownCostLines: inputs.unknownCostLines,
    unknownCostRevenue: round2(inputs.unknownCostRevenue),
    wasteLoss: round2(wasteLoss),
    taxCollected: round2(taxCollected),
    serviceCharge: round2(inputs.serviceCharge),
    processingFee: round2(processingFee),
    netRevenue: round2(netRevenue),
    netProfit: round2(netProfit),
    orderCount: inputs.orderCount,
  };
}

/**
 * Loads and derives one store's summary. `orderFilters` narrows every ORDER
 * query (shift/staff, channel, payment method — see report-filters.ts); waste
 * has no order linkage, so it is only ever scoped by date.
 */
export async function computeStoreFinanceSummary(
  storeId: string,
  window: { from: Date; to: Date },
  orderFilters: Prisma.OrderWhereInput = {}
): Promise<StoreFinanceSummary & { currency: string }> {
  const orderWhere: Prisma.OrderWhereInput = {
    storeId,
    status: { notIn: NON_REVENUE_STATUSES },
    orderDate: { gte: window.from, lte: window.to },
    ...orderFilters,
  };

  const [revenueResult, processingFeeResult, cogsResult, wasteResult, currencyAndRate] =
    await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _sum: {
          total: true,
          subtotal: true,
          tax: true,
          serviceCharge: true,
          discountAmount: true,
          refundAmount: true,
        },
        _count: { id: true },
      }),
      // Processing fee only accrues on orders that actually got charged — an
      // abandoned/unpaid QRIS order never incurred a fee.
      prisma.order.aggregate({
        where: { ...orderWhere, paymentStatus: "PAID" },
        _sum: { processingFee: true },
      }),
      // COGS — see src/lib/finance/cogs.ts. Frozen per-line snapshots where
      // they exist, the legacy material-SALE ledger for orders that predate
      // them, and uncosted lines counted rather than silently zeroed.
      sumCogsBase(orderWhere),
      prisma.wasteEntry.aggregate({
        where: { storeId, createdAt: { gte: window.from, lte: window.to } },
        _sum: { totalValue: true },
      }),
      storefrontService.getOwnerCurrencyAndRate(storeId),
    ]);

  const summary = deriveStoreSummary(
    {
      revenue: Number(revenueResult._sum.total ?? 0),
      orderCount: revenueResult._count.id,
      taxCollected: Number(revenueResult._sum.tax ?? 0),
      serviceCharge: Number(revenueResult._sum.serviceCharge ?? 0),
      discountAmount: Number(revenueResult._sum.discountAmount ?? 0),
      refundAmount: Number(revenueResult._sum.refundAmount ?? 0),
      processingFee: Number(processingFeeResult._sum.processingFee ?? 0),
      cogsBase: cogsResult.cogsBase,
      unknownCostLines: cogsResult.unknownCostLines,
      unknownCostRevenue: cogsResult.unknownCostRevenue,
      wasteBase: Number(wasteResult._sum.totalValue ?? 0),
    },
    currencyAndRate.rate
  );

  return { ...summary, currency: currencyAndRate.currency };
}
