/**
 * GET /api/stores/[id]/finance/adjustments
 *
 * Money given away or handed back — discounts by reason (or coupon), refunds
 * by reason, cancelled orders and voided lines — for spotting leaks.
 *
 * Discounts and refunds follow the summary's rules (the order's own date,
 * cancelled and held orders excluded), so their totals equal the P&L's
 * Discounts and Refunds lines. Cancelled orders are the excluded ones, counted
 * here on their own. Order has no "rung up by" field, so nothing is split by
 * staff member.
 *
 * Query params: from, to, staffId, shiftId, channel, paymentMethod
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { buildAdjustmentsReport } from "@/lib/finance/insights";
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

    const scope: Prisma.OrderWhereInput = {
      storeId,
      orderDate: { gte: from, lte: to },
      ...shiftFilter(searchParams),
      ...channelFilter(searchParams.get("channel")),
      ...paymentMethodFilter(searchParams.get("paymentMethod")),
    };
    const revenueOrders: Prisma.OrderWhereInput = {
      ...scope,
      status: { notIn: NON_REVENUE_STATUSES },
    };

    const [discounted, refunded, cancelled, voidedLines] = await Promise.all([
      prisma.order.findMany({
        where: { ...revenueOrders, discountAmount: { gt: 0 } },
        select: { discountAmount: true, discountReason: true, coupon: { select: { code: true } } },
      }),
      prisma.order.findMany({
        where: { ...revenueOrders, refundAmount: { gt: 0 } },
        select: { refundAmount: true, refundReason: true },
      }),
      prisma.order.aggregate({
        where: { ...scope, status: "CANCELLED" },
        _sum: { total: true },
        _count: { id: true },
      }),
      // A line cancelled after the order was rung up, on an order that still
      // counts as a sale.
      prisma.orderItem.findMany({
        where: { status: "CANCELLED", order: revenueOrders },
        select: { name: true, quantity: true, total: true },
      }),
    ]);

    const report = buildAdjustmentsReport({
      discounted: discounted.map((o) => ({
        discountAmount: o.discountAmount,
        discountReason: o.discountReason,
        couponCode: o.coupon?.code ?? null,
      })),
      refunded,
      cancelled: { orderCount: cancelled._count.id, value: Number(cancelled._sum.total ?? 0) },
      voidedLines,
    });

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), ...report })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/adjustments", requireStoreAuth: true }
);
