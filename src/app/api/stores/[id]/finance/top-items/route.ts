/**
 * GET /api/stores/[id]/finance/top-items
 *
 * Returns top-selling items by revenue and quantity for a date range.
 * Query params: from, to, limit (default 10), includeTotals ("1" adds
 * `totals` — every matching line, not just the top `limit`, so the report
 * can show what the list leaves out).
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import {
  shiftFilter,
  categoryFilter,
  departmentFilter,
  channelFilter,
  paymentMethodFilter,
} from "@/lib/finance/report-filters";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);
    const shiftWhere = shiftFilter(searchParams);

    const where: Prisma.OrderItemWhereInput = {
        order: {
          storeId,
          status: { notIn: NON_REVENUE_STATUSES },
          orderDate: { gte: from, lte: to },
          ...shiftWhere,
          ...channelFilter(searchParams.get("channel")),
          ...paymentMethodFilter(searchParams.get("paymentMethod")),
        },
        // Combined via AND (not spread) since both filters can independently
        // produce an "OR: [...]" clause (the "none"/"unassigned" sentinels) —
        // spreading two OR keys into one object would silently drop the first.
        AND: [categoryFilter(searchParams.get("category")), departmentFilter(searchParams.get("department"))],
    };

    const items = await prisma.orderItem.groupBy({
      by: ["name"],
      where,
      _sum: { total: true, quantity: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: limit,
    });

    const topItems = items.map((item) => ({
      name: item.name,
      orderCount: item._count.id,
      totalQuantity: Number(item._sum.quantity ?? 0),
      totalRevenue: Math.round(Number(item._sum.total ?? 0) * 100) / 100,
    }));

    // Opt-in: the dashboard and storefront cards only want the top few.
    let totals: { itemCount: number; totalQuantity: number; totalRevenue: number } | undefined;
    if (searchParams.get("includeTotals") === "1") {
      const [sums, names] = await Promise.all([
        prisma.orderItem.aggregate({ where, _sum: { total: true, quantity: true } }),
        prisma.orderItem.groupBy({ by: ["name"], where }),
      ]);
      totals = {
        itemCount: names.length,
        totalQuantity: Math.round(Number(sums._sum.quantity ?? 0) * 100) / 100,
        totalRevenue: Math.round(Number(sums._sum.total ?? 0) * 100) / 100,
      };
    }

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        items: topItems,
        ...(totals && { totals }),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/top-items", requireStoreAuth: true }
);
