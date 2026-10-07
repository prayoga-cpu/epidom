/**
 * GET /api/stores/[id]/finance/tax
 *
 * Tax grouped by the rate frozen on each order (Order.taxRate): the base it
 * was charged on, the tax charged, the share handed back with refunds and the
 * tax owed — what a PPN or TVA return asks for. The "owed" total equals the
 * summary's Tax card for the same filters.
 *
 * Query params: from, to, staffId, shiftId, channel, paymentMethod
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { buildTaxRows } from "@/lib/finance/insights";
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

    const orders = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftFilter(searchParams),
        ...channelFilter(searchParams.get("channel")),
        ...paymentMethodFilter(searchParams.get("paymentMethod")),
      },
      select: {
        taxRate: true,
        subtotal: true,
        serviceCharge: true,
        tax: true,
        total: true,
        refundAmount: true,
      },
    });

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        rates: buildTaxRows(orders),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/tax", requireStoreAuth: true }
);
