/**
 * GET /api/stores/[id]/finance/top-items
 *
 * Returns top-selling items by revenue and quantity for a date range.
 * Query params: from, to, limit (default 10)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

    const items = await prisma.orderItem.groupBy({
      by: ["name"],
      where: {
        order: {
          storeId,
          status: { notIn: [OrderStatus.CANCELLED] },
          orderDate: { gte: from, lte: to },
        },
      },
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

    return NextResponse.json(createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), items: topItems }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/top-items", requireStoreAuth: true }
);
