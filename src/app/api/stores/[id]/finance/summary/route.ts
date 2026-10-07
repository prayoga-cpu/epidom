/**
 * GET /api/stores/[id]/finance/summary
 *
 * Returns revenue, COGS, gross margin and net profit for a date range, plus
 * the store's currency. Operations plan and up (FEATURE_MIN_PLAN.finance).
 *
 * Query params:
 *   from  — ISO date (default: start of current month)
 *   to    — ISO date (default: now)
 *   period — "day" | "week" | "month" (groups result buckets)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { computeStoreFinanceSummary } from "@/lib/finance/store-summary";
import { bucketOrdersByDay } from "@/lib/finance/report-aggregation";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requireFinanceReportAccessApi(storeId!);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // start of month
    const from = new Date(searchParams.get("from") ?? defaultFrom.toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const shiftWhere = shiftFilter(searchParams);
    const channelWhere = channelFilter(searchParams.get("channel"));
    const paymentWhere = paymentMethodFilter(searchParams.get("paymentMethod"));

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    // Every figure the KPI cards and P&L show — the same function each row
    // of the All outlets roll-up uses, so the two can never disagree.
    const orderFilters = { ...shiftWhere, ...channelWhere, ...paymentWhere };
    const summary = await computeStoreFinanceSummary(storeId!, { from, to }, orderFilters);

    // Daily breakdown — grouped in memory to avoid Prisma groupBy
    // timezone/timestamp issues. Each day carries the P&L lines the KPI cards
    // show, so the Daily tab's column totals equal the cards.
    const rawOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...channelWhere,
        ...paymentWhere,
      },
      select: { orderDate: true, total: true, discountAmount: true, tax: true, refundAmount: true },
      orderBy: { orderDate: "asc" },
    });

    const buckets = bucketOrdersByDay(rawOrders);

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        ...summary,
        buckets,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/summary", requireStoreAuth: true }
);
