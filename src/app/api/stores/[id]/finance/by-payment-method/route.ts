/**
 * GET /api/stores/[id]/finance/by-payment-method
 *
 * Revenue/order-count breakdown by how the customer actually paid (cash,
 * QRIS, GoPay, ...). Query params: from, to, staffId, shiftId, channel
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter } from "@/lib/finance/report-filters";
import { buildPaymentMethodRows } from "@/lib/finance/report-aggregation";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const shiftWhere = shiftFilter(searchParams);
    const channelWhere = channelFilter(searchParams.get("channel"));

    const grouped = await prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...channelWhere,
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const methods = buildPaymentMethodRows(grouped);

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), methods })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-payment-method", requireStoreAuth: true }
);
