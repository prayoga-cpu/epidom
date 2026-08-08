import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { buildOrderHistoryWhere } from "@/lib/services/order-history-query";
import { buildPaymentMethodRows } from "@/lib/finance/report-aggregation";

/**
 * GET /api/stores/[id]/orders/payment-totals
 *
 * Revenue/order-count per payment method for whatever's currently matched by
 * the History tab's filters — same query params and `where` clause as
 * GET /api/stores/[id]/orders (via buildOrderHistoryWhere), so this total
 * always agrees with what's actually shown in the History table, not a
 * separately-defined "revenue" concept like the Finance reports use. Lets
 * cashiers/managers on the History tab (no Finance Reports access by
 * default — see staff-permissions.config.ts) audit "how much came in via
 * each method" for any date range themselves, not just the store owner.
 */
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q");
    const unpaid = searchParams.get("unpaid") === "1";
    const productId = searchParams.get("productId");
    const department = searchParams.get("department");
    const staffId = searchParams.get("staffId");
    const paymentMethod = searchParams.get("paymentMethod");

    if (from && isNaN(new Date(from).getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }
    if (to && isNaN(new Date(to).getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    const where = buildOrderHistoryWhere(storeId!, {
      status,
      source,
      from,
      to,
      q,
      unpaid,
      productId,
      department,
      staffId,
      paymentMethod,
    });

    const grouped = await prisma.order.groupBy({
      by: ["paymentMethod"],
      where,
      _sum: { total: true },
      _count: { id: true },
    });

    const methods = buildPaymentMethodRows(grouped);
    const totalRevenue = Math.round(methods.reduce((sum, m) => sum + m.revenue, 0) * 100) / 100;
    const totalOrders = methods.reduce((sum, m) => sum + m.orderCount, 0);

    return NextResponse.json(createSuccessResponse({ methods, totalRevenue, totalOrders }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/orders/payment-totals", requireStoreAuth: true }
);
