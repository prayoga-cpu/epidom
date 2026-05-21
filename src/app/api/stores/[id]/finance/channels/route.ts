/**
 * GET /api/stores/[id]/finance/channels
 *
 * Returns per-channel P&L with commission deductions.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { OrderStatus, OrderSource } from "@prisma/client";
import { commissionRate, AGGREGATOR_LABELS } from "@/config/aggregator.config";

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
    const from = new Date(searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());

    const grouped = await prisma.order.groupBy({
      by: ["source"],
      where: {
        storeId,
        status: { notIn: [OrderStatus.CANCELLED] },
        orderDate: { gte: from, lte: to },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const channels = grouped.map((g) => {
      const revenue = Number(g._sum.total ?? 0);
      const commission = commissionRate(g.source);
      const commissionAmount = Math.round(revenue * commission * 100) / 100;
      const netRevenue = Math.round((revenue - commissionAmount) * 100) / 100;
      return {
        source: g.source,
        label: SOURCE_LABELS[g.source] ?? g.source,
        orderCount: g._count.id,
        revenue: Math.round(revenue * 100) / 100,
        commissionPct: commission * 100,
        commissionAmount,
        netRevenue,
      };
    });

    // Sort: highest revenue first
    channels.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json(createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), channels }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/channels", requireStoreAuth: true }
);
