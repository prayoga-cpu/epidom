import type { OrderSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { commissionRate, ONLINE_PLATFORM_LABELS } from "@/config/aggregator.config";
import { refundedTaxPortion } from "@/lib/finance/order-charges";
import { estimatePlatformCommission } from "@/lib/finance/store-summary";

/**
 * The By Channel report — one P&L line per sales channel. Shared by the
 * channels route and the PDF print page; the PDF used to carry its own copy of
 * this arithmetic, which is how the two drifted apart.
 */

const SOURCE_LABELS: Record<OrderSource, string> = {
  MANUAL: "Manual",
  STOREFRONT: "Storefront",
  POS: "POS Cashier",
  ...ONLINE_PLATFORM_LABELS,
};

export interface ChannelReportRow {
  source: OrderSource;
  label: string;
  orderCount: number;
  revenue: number;
  commissionPct: number;
  commissionAmount: number;
  refundAmount: number;
  /** Tax owed: charged, less the tax share of refunds. */
  taxAmount: number;
  processingFeeAmount: number;
  netRevenue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `orderFilters` narrows the orders (till session/staff, payment method). The
 * channel filter is deliberately not one of them: this report is the
 * breakdown BY channel.
 */
export async function loadChannelRows(
  storeId: string,
  window: { from: Date; to: Date },
  orderFilters: Prisma.OrderWhereInput = {}
): Promise<ChannelReportRow[]> {
  const where: Prisma.OrderWhereInput = {
    storeId,
    status: { notIn: NON_REVENUE_STATUSES },
    orderDate: { gte: window.from, lte: window.to },
    ...orderFilters,
  };

  const [grouped, feeGrouped, refundedOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ["source"],
      where,
      _sum: { total: true, tax: true, refundAmount: true },
      _count: { id: true },
    }),
    // Processing fee only accrues on orders that were actually charged.
    prisma.order.groupBy({
      by: ["source"],
      where: { ...where, paymentStatus: "PAID" },
      _sum: { processingFee: true },
    }),
    // A refunded sale owes no tax — the tax share of each refund comes back
    // off the channel's tax, by the same rule as the summary's Tax card.
    prisma.order.findMany({
      where: { ...where, refundAmount: { gt: 0 } },
      select: { source: true, total: true, tax: true, refundAmount: true },
    }),
  ]);

  const feeBySource = new Map(feeGrouped.map((g) => [g.source, Number(g._sum.processingFee ?? 0)]));
  const refundedTaxBySource = new Map<OrderSource, number>();
  for (const o of refundedOrders) {
    refundedTaxBySource.set(
      o.source,
      (refundedTaxBySource.get(o.source) ?? 0) + refundedTaxPortion(o)
    );
  }

  return grouped
    .map((g) => {
      const revenue = round2(Number(g._sum.total ?? 0));
      const taxAmount = round2(Number(g._sum.tax ?? 0) - (refundedTaxBySource.get(g.source) ?? 0));
      const refundAmount = round2(Number(g._sum.refundAmount ?? 0));
      const processingFeeAmount = round2(feeBySource.get(g.source) ?? 0);
      // The estimate the P&L's commission line adds up from — one formula.
      const commissionAmount = estimatePlatformCommission(g.source, revenue);
      // Same order as the P&L: revenue less refunds and tax owed, then the
      // channel's costs (platform commission, payment processing). Refunds
      // used to be left in, so the channels never added up to the summary.
      const netRevenue = round2(
        revenue - refundAmount - taxAmount - commissionAmount - processingFeeAmount
      );
      return {
        source: g.source,
        label: SOURCE_LABELS[g.source] ?? g.source,
        orderCount: g._count.id,
        revenue,
        // Rounded to 2 decimals: 0.14 * 100 is 14.000000000000002 in floating point.
        commissionPct: Math.round(commissionRate(g.source) * 10000) / 100,
        commissionAmount,
        refundAmount,
        taxAmount,
        processingFeeAmount,
        netRevenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
