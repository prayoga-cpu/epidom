/**
 * GET /api/stores/[id]/finance/summary
 *
 * Returns revenue, COGS, and gross margin for a date range.
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
import { MovementType } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";

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

    // Revenue: sum of completed order totals
    const revenueResult = await prisma.order.aggregate({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
      },
      _sum: { total: true, subtotal: true },
      _count: { id: true },
    });

    const revenue = Number(revenueResult._sum.total ?? 0);
    const orderCount = revenueResult._count.id;

    // COGS: sum of SALE stock movements (negative qty = cost)
    // balanceAfter is not cost; use qty * material.unitCost via joining
    const cogsMovements = await prisma.stockMovement.findMany({
      where: {
        type: MovementType.SALE,
        order: {
          storeId,
          orderDate: { gte: from, lte: to },
          status: { notIn: NON_REVENUE_STATUSES },
        },
        materialId: { not: null },
      },
      include: { material: { select: { unitCost: true } } },
    });

    const cogs = cogsMovements.reduce((sum, m) => {
      const qty = Math.abs(Number(m.quantity));
      const cost = Number(m.material?.unitCost ?? 0);
      return sum + qty * cost;
    }, 0);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Daily breakdown for chart using memory grouping to avoid Prisma groupBy timezone/timestamp issues
    const rawOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
      },
      select: { orderDate: true, total: true },
      orderBy: { orderDate: "asc" },
    });

    const bucketMap = new Map<string, number>();
    for (const d of rawOrders) {
      const dateKey = d.orderDate.toISOString().split("T")[0];
      const current = bucketMap.get(dateKey) ?? 0;
      bucketMap.set(dateKey, current + Number(d.total ?? 0));
    }

    const buckets = Array.from(bucketMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        revenue,
        cogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMarginPct: Math.round(grossMargin * 100) / 100,
        orderCount,
        buckets,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/summary", requireStoreAuth: true }
);
