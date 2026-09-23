/**
 * GET /api/stores/[id]/finance/by-payment-method
 *
 * Revenue/order-count breakdown by how the customer actually paid (cash,
 * QRIS, GoPay, ...). Query params: from, to, staffId, shiftId, channel
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter } from "@/lib/finance/report-filters";
import { buildTenderPaymentMethodRows } from "@/lib/finance/report-aggregation";

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

    const orderWhere: Prisma.OrderWhereInput = {
      storeId,
      status: { notIn: NON_REVENUE_STATUSES },
      orderDate: { gte: from, lte: to },
      ...shiftWhere,
      ...channelWhere,
    };

    // Two groupBys over the SAME order filter, unioned: tenders for every
    // order that has them (so a cash+card bill lands under CASH and the card,
    // not under a meaningless "SPLIT" row), and the whole-order method for
    // orders placed before OrderPayment existed, which have no rows and are
    // never backfilled. The sets are disjoint — an order either has rows or it
    // does not — so nothing is counted twice.
    const [tenderGroups, legacyGroups] = await Promise.all([
      prisma.orderPayment.groupBy({
        by: ["method"],
        where: { order: orderWhere },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.order.groupBy({
        by: ["paymentMethod"],
        where: { ...orderWhere, payments: { none: {} } },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const methods = buildTenderPaymentMethodRows(tenderGroups, legacyGroups);

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), methods })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-payment-method", requireStoreAuth: true }
);
