import type { OrderSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { sumCogsBase } from "@/lib/finance/cogs";
import { storefrontService } from "@/lib/services/storefront.service";
import { refundedTaxPortion } from "@/lib/finance/order-charges";
import { commissionRate } from "@/config/aggregator.config";

export { refundedTaxPortion };

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
  /** The tax share of the refunds in `refundAmount` — see refundedTaxPortion.
   * Optional so callers that never refund (and old fixtures) read as 0. */
  refundedTax?: number;
  /** Estimated delivery-app commission (revenue × the platform's rate, the
   * same estimate as the By Channel tab). Optional, 0 when absent. */
  platformCommission?: number;
  /** Delivery fees charged to customers — part of revenue. */
  deliveryFee?: number;
  /** Orders in the window still waiting on payment (PAY_LATER, an unfinished
   * QRIS, a failed card) — counted in revenue, not yet collected. */
  awaitingPaymentAmount?: number;
  awaitingPaymentCount?: number;
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
  /** Tax still owed on the window's sales: tax charged minus the tax share of
   * any refund (a refunded sale owes no tax). */
  taxCollected: number;
  serviceCharge: number;
  processingFee: number;
  /** Sales the business keeps: revenue less refunds and tax owed. */
  netSales: number;
  netRevenue: number;
  /** Estimated delivery-app commission, deducted from net profit. */
  platformCommission: number;
  netProfit: number;
  orderCount: number;
  deliveryFee: number;
  awaitingPaymentAmount: number;
  awaitingPaymentCount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The commission a delivery app keeps on one channel's revenue, at the
 * platform's standard rate (aggregator.config.ts) — 0 for the store's own
 * channels. Shared with the By Channel tab so the two estimates agree.
 */
export function estimatePlatformCommission(source: OrderSource, revenue: number): number {
  return round2(revenue * commissionRate(source));
}

/**
 * Pure: turns the raw sums into the reported figures. `rate` converts IDR
 * into the store's currency (1 for an IDR store).
 *
 * The figures form one statement that adds up line by line, which is how the
 * P&L tab prints it:
 *
 *   grossRevenue − discountAmount           = revenue
 *   revenue − refundAmount − taxCollected   = netSales
 *   netSales − cogs                         = grossProfit
 *   grossProfit − processingFee
 *               − platformCommission − wasteLoss = netProfit
 *
 * Every subtotal is taken from the rounded lines above it, so the printed
 * statement foots to the cent.
 */
export function deriveStoreSummary(inputs: StoreSummaryInputs, rate: number): StoreFinanceSummary {
  const { revenue } = inputs;

  // revenue (and everything derived from Order.total) is already a literal
  // value in the store's own currency; cogs comes from Material.unitCost,
  // stored in IDR (the platform base currency). Mixing them in
  // `revenue - cogs` without converting first produces a nonsensical figure
  // for any non-IDR store — convert cogs (and waste loss) before combining.
  const cogs = round2(storefrontService.convertBaseToOwnerSync(inputs.cogsBase, rate));
  // Waste loss (expired/damaged/spoiled/... inventory) is shrinkage, not
  // cost-of-goods-sold for items that actually sold, so it's kept out of
  // cogs/grossProfit and only reduces the netProfit bottom line.
  const wasteLoss = round2(storefrontService.convertBaseToOwnerSync(inputs.wasteBase, rate));

  const sales = round2(revenue);
  const discountAmount = round2(inputs.discountAmount);
  const refundAmount = round2(inputs.refundAmount);
  const processingFee = round2(inputs.processingFee);
  // What GoFood/GrabFood/... keep before paying out. An estimate from the
  // platform's standard rate, but a real cost: leaving it out reported a
  // delivery-app sale as if the store kept every rupiah of it.
  const platformCommission = round2(inputs.platformCommission ?? 0);
  // Tax is the government's, not the business's — and a refunded sale owes
  // none. Subtracting the full tax charged next to the full (tax-inclusive)
  // refund took the tax on a refunded order off twice.
  const taxCollected = round2(inputs.taxCollected - (inputs.refundedTax ?? 0));

  // `total` is already post-discount (computeOrderCharges applies the
  // discount before subtotal/tax/total are derived) — grossRevenue backs the
  // pre-discount figure out for the P&L statement, it is not an independent
  // sum.
  const grossRevenue = round2(sales + discountAmount);
  // Refunds are attributed to the original order's orderDate (accrual-style,
  // not the later refundedAt) — every other figure here is scoped that way.
  const netSales = round2(sales - refundAmount - taxCollected);
  // Gross profit is measured on net sales. It used to be revenue − COGS,
  // which counted the tax collected for the government (and refunded sales)
  // as profit and overstated the margin of every store that charges tax.
  const grossProfit = round2(netSales - cogs);
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  // netRevenue: net sales after the payment provider's cut.
  const netRevenue = round2(netSales - processingFee);
  const netProfit = round2(grossProfit - processingFee - platformCommission - wasteLoss);

  return {
    revenue,
    grossRevenue,
    discountAmount,
    refundAmount,
    cogs,
    grossProfit,
    grossMarginPct: round2(grossMargin),
    // Lines with no cost source at all (aggregator orders can never acquire
    // one). Surfaced so the UI can annotate the figure instead of implying
    // these sold at 100% margin. NOT converted: derived from OrderItem.total,
    // which — like revenue — is already in the store's own currency.
    unknownCostLines: inputs.unknownCostLines,
    unknownCostRevenue: round2(inputs.unknownCostRevenue),
    wasteLoss,
    taxCollected,
    serviceCharge: round2(inputs.serviceCharge),
    processingFee,
    netSales,
    netRevenue,
    platformCommission,
    netProfit,
    orderCount: inputs.orderCount,
    deliveryFee: round2(inputs.deliveryFee ?? 0),
    awaitingPaymentAmount: round2(inputs.awaitingPaymentAmount ?? 0),
    awaitingPaymentCount: inputs.awaitingPaymentCount ?? 0,
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

  const [
    revenueResult,
    processingFeeResult,
    cogsResult,
    wasteResult,
    currencyAndRate,
    refundedOrders,
    revenueBySource,
    awaitingPayment,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _sum: {
        total: true,
        subtotal: true,
        tax: true,
        serviceCharge: true,
        discountAmount: true,
        refundAmount: true,
        delivery: true,
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
    // Only refunded orders — a handful — to split each refund's tax back out.
    prisma.order.findMany({
      where: { ...orderWhere, refundAmount: { gt: 0 } },
      select: { total: true, tax: true, refundAmount: true },
    }),
    // Per channel, for the delivery-app commission.
    prisma.order.groupBy({ by: ["source"], where: orderWhere, _sum: { total: true } }),
    prisma.order.aggregate({
      where: { ...orderWhere, paymentStatus: { in: ["PENDING", "FAILED", "EXPIRED"] } },
      _sum: { total: true },
      _count: { id: true },
    }),
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
      refundedTax: refundedOrders.reduce((sum, o) => sum + refundedTaxPortion(o), 0),
      platformCommission: revenueBySource.reduce(
        (sum, g) => sum + estimatePlatformCommission(g.source, Number(g._sum.total ?? 0)),
        0
      ),
      deliveryFee: Number(revenueResult._sum.delivery ?? 0),
      awaitingPaymentAmount: Number(awaitingPayment._sum.total ?? 0),
      awaitingPaymentCount: awaitingPayment._count.id,
    },
    currencyAndRate.rate
  );

  return { ...summary, currency: currencyAndRate.currency };
}
