/**
 * GET /api/stores/[id]/finance/sales-patterns
 *
 * When and how the store sells: revenue by order type (dine-in, takeaway,
 * delivery), by hour of day and weekday in the business's own time zone, and
 * guests (covers) with revenue per guest.
 *
 * Query params: from, to, staffId, shiftId, channel, paymentMethod — the same
 * order filters as the summary, so the totals match the Revenue card.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { buildSalesPatterns } from "@/lib/finance/insights";
import { financeReportRangeSchema } from "@/lib/validation/finance-report.schemas";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requireFinanceReportAccessApi(storeId!);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const range = financeReportRangeSchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    if (!range.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid from/to date",
          range.error.flatten()
        ),
        { status: 400 }
      );
    }
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());

    const [store, orders] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: { business: { select: { timezone: true } } },
      }),
      prisma.order.findMany({
        where: {
          storeId,
          status: { notIn: NON_REVENUE_STATUSES },
          orderDate: { gte: from, lte: to },
          ...shiftFilter(searchParams),
          ...channelFilter(searchParams.get("channel")),
          ...paymentMethodFilter(searchParams.get("paymentMethod")),
        },
        select: { orderDate: true, total: true, orderType: true, guestCount: true },
      }),
    ]);
    const timezone = store?.business.timezone ?? "UTC";

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        timezone,
        ...buildSalesPatterns(orders, timezone),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/sales-patterns", requireStoreAuth: true }
);
