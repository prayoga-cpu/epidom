import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { OrderStatus, OrderSource } from "@prisma/client";
import { serializePosOrders } from "@/lib/server/serialize";

/**
 * GET /api/stores/[id]/orders
 * Paginated order history for a store with status/source/date/search filters.
 *
 * Query params:
 *   status — OrderStatus filter (ignored if "all" or invalid)
 *   source — OrderSource filter (ignored if "all" or invalid)
 *   from/to — ISO datetime range applied to orderDate
 *   q — matches orderNumber or customerName (case-insensitive)
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
    const cursor = searchParams.get("cursor");
    const take = Math.min(Math.max(parseInt(searchParams.get("take") ?? "25", 10) || 25, 1), 100);

    const where: Record<string, unknown> = { storeId };

    if (status && (Object.values(OrderStatus) as string[]).includes(status)) {
      where.status = status;
    }

    if (source && (Object.values(OrderSource) as string[]).includes(source)) {
      where.source = source;
    }

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      if ((fromDate && isNaN(fromDate.getTime())) || (toDate && isNaN(toDate.getTime()))) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
          { status: 400 }
        );
      }
      where.orderDate = {} as Record<string, Date>;
      if (fromDate) (where.orderDate as Record<string, Date>).gte = fromDate;
      if (toDate) (where.orderDate as Record<string, Date>).lte = toDate;
    }

    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [rows, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ orderDate: "desc" }, { id: "desc" }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          table: { select: { label: true } },
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

    return NextResponse.json(
      createSuccessResponse({ orders: serializePosOrders(orders), nextCursor, totalCount })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/orders", requireStoreAuth: true }
);
