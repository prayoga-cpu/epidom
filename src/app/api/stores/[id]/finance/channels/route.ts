/**
 * GET /api/stores/[id]/finance/channels
 *
 * Returns per-channel P&L with commission deductions.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { OrderSource } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { commissionRate, AGGREGATOR_LABELS } from "@/config/aggregator.config";
import { shiftFilter, paymentMethodFilter } from "@/lib/finance/report-filters";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<OrderSource, string> = {
  MANUAL: "Manual",
  STOREFRONT: "Storefront",
  POS: "POS Cashier",
  GOFOOD: AGGREGATOR_LABELS.GOFOOD,
  GRABFOOD: AGGREGATOR_LABELS.GRABFOOD,
  SHOPEEFOOD: AGGREGATOR_LABELS.SHOPEEFOOD,
  TOKOPEDIA: AGGREGATOR_LABELS.TOKOPEDIA,
};

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const shiftWhere = shiftFilter(searchParams);
    const paymentWhere = paymentMethodFilter(searchParams.get("paymentMethod"));

    const grouped = await prisma.order.groupBy({
      by: ["source"],
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...paymentWhere,
      },
      _sum: { total: true, tax: true },
      _count: { id: true },
    });

    // Processing fee only accrues on orders that were actually charged.
    const feeGrouped = await prisma.order.groupBy({
      by: ["source"],
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        paymentStatus: "PAID",
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...paymentWhere,
      },
      _sum: { processingFee: true },
    });
    const feeBySource = new Map(
      feeGrouped.map((g) => [g.source, Number(g._sum.processingFee ?? 0)])
    );

    const channels = grouped.map((g) => {
      const revenue = Number(g._sum.total ?? 0);
      const taxAmount = Math.round(Number(g._sum.tax ?? 0) * 100) / 100;
      const processingFeeAmount = Math.round((feeBySource.get(g.source) ?? 0) * 100) / 100;
      const commission = commissionRate(g.source);
      const commissionAmount = Math.round(revenue * commission * 100) / 100;
      const netRevenue =
        Math.round((revenue - commissionAmount - processingFeeAmount - taxAmount) * 100) / 100;
      return {
        source: g.source,
        label: SOURCE_LABELS[g.source] ?? g.source,
        orderCount: g._count.id,
        revenue: Math.round(revenue * 100) / 100,
        commissionPct: commission * 100,
        commissionAmount,
        taxAmount,
        processingFeeAmount,
        netRevenue,
      };
    });

    // Sort: highest revenue first
    channels.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), channels })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/channels", requireStoreAuth: true }
);
