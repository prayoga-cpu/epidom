/**
 * GET /api/stores/[id]/orders/analytics
 *
 * Returns order volume, revenue, and status/type breakdowns for a date range.
 *
 * Query params:
 *   from  — ISO date (default: start of current month)
 *   to    — ISO date (default: now)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // start of month
    const from = new Date(searchParams.get("from") ?? defaultFrom.toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    // Totals: order count, revenue, average order value (CANCELLED excluded)
    const totals = await prisma.order.aggregate({
      where: {
        storeId,
        status: { notIn: [OrderStatus.CANCELLED] },
        orderDate: { gte: from, lte: to },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const revenue = Math.round(Number(totals._sum.total ?? 0) * 100) / 100;
    const totalOrders = totals._count.id;
    const aov = totalOrders > 0 ? Math.round((revenue / totalOrders) * 100) / 100 : 0;

    // Daily breakdown for chart using memory grouping to avoid Prisma groupBy timezone/timestamp issues
    const rawOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: [OrderStatus.CANCELLED] },
        orderDate: { gte: from, lte: to },
      },
      select: { orderDate: true, total: true },
      orderBy: { orderDate: "asc" },
    });

    const bucketMap = new Map<string, { orderCount: number; revenue: number }>();
    for (const d of rawOrders) {
      const dateKey = d.orderDate.toISOString().split("T")[0];
      const current = bucketMap.get(dateKey) ?? { orderCount: 0, revenue: 0 };
      current.orderCount += 1;
      current.revenue += Number(d.total ?? 0);
      bucketMap.set(dateKey, current);
    }

    const buckets = Array.from(bucketMap.entries()).map(([date, b]) => ({
      date,
      orderCount: b.orderCount,
      revenue: Math.round(b.revenue * 100) / 100,
    }));

    // Status breakdown — INCLUDES cancelled so the funnel is complete
    const statusGroups = await prisma.order.groupBy({
      by: ["status"],
      where: {
        storeId,
        orderDate: { gte: from, lte: to },
      },
      _count: { id: true },
    });

    const byStatus = statusGroups.map((g) => ({
      status: g.status,
      orderCount: g._count.id,
    }));

    // Order type breakdown — excludes cancelled
    const typeGroups = await prisma.order.groupBy({
      by: ["orderType"],
      where: {
        storeId,
        status: { notIn: [OrderStatus.CANCELLED] },
        orderDate: { gte: from, lte: to },
      },
      _count: { id: true },
    });

    const byOrderType = typeGroups.map((g) => ({
      orderType: g.orderType,
      orderCount: g._count.id,
    }));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        totalOrders,
        revenue,
        aov,
        buckets,
        byStatus,
        byOrderType,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/orders/analytics", requireStoreAuth: true }
);
