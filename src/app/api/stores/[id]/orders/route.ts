import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { serializePosOrders } from "@/lib/server/serialize";
import { buildOrderHistoryWhere } from "@/lib/services/order-history-query";

/**
 * GET /api/stores/[id]/orders
 * Paginated order history for a store with status/source/date/search filters.
 *
 * Query params:
 *   status — OrderStatus filter (ignored if "all" or invalid)
 *   source — OrderSource filter (ignored if "all" or invalid)
 *   from/to — ISO datetime range applied to orderDate
 *   q — matches orderNumber or customerName (case-insensitive)
 *   unpaid — "1" filters to paymentStatus PENDING only
 *   productId — menu item id, order must contain a line for it
 *   department — "KITCHEN" | "BAR", order must contain an item from it
 *   staffId — StaffMember id, order's shift must belong to them
 *   paymentMethod — PaymentMethod filter (ignored if invalid)
 *   take — page size (default 25, max 100)
 *   cursor — order id for cursor pagination
 */
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
    const cursor = searchParams.get("cursor");
    const take = Math.min(Math.max(parseInt(searchParams.get("take") ?? "25", 10) || 25, 1), 100);

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

    const [rows, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ orderDate: "desc" }, { id: "desc" }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          table: { select: { label: true } },
          // Per-tender breakdown. `include` already returns every scalar
          // column (customerId, splitGroupId, pointsRedeemed, pointsEarned
          // included), but a relation has to be asked for explicitly — and
          // without it the history dialog cannot show how a split bill was
          // actually settled, nor which tender a refund should come off.
          payments: {
            select: {
              id: true,
              method: true,
              amount: true,
              amountTendered: true,
              change: true,
              note: true,
              refundedAmount: true,
            },
            orderBy: { createdAt: "asc" },
          },
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unitPrice: true,
              total: true,
              menuItem: { select: { name: true } },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const hasMore = rows.length > take;
    const orders = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? orders[orders.length - 1].id : null;

    // serializePosOrder only knows the Order's own Decimal columns, and a
    // Decimal left untouched serialises as a *string* (Decimal.toJSON()),
    // which the client would then string-concatenate instead of adding. The
    // tender rows get the same number treatment here — see OrderPaymentDto.
    const serialized = serializePosOrders(orders).map((order) => ({
      ...order,
      payments: (order.payments ?? []).map(
        (payment: {
          id: string;
          method: string;
          amount: unknown;
          amountTendered: unknown;
          change: unknown;
          note: string | null;
          refundedAmount: unknown;
        }) => ({
          id: payment.id,
          method: payment.method,
          amount: Number(payment.amount),
          amountTendered: payment.amountTendered == null ? null : Number(payment.amountTendered),
          change: payment.change == null ? null : Number(payment.change),
          note: payment.note,
          refundedAmount: Number(payment.refundedAmount),
        })
      ),
    }));

    return NextResponse.json(createSuccessResponse({ orders: serialized, nextCursor, totalCount }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/orders", requireStoreAuth: true }
);
