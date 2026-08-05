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
import { shiftFilter } from "@/lib/finance/report-filters";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // start of month
    const from = new Date(searchParams.get("from") ?? defaultFrom.toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const shiftWhere = shiftFilter(searchParams);

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
        ...shiftWhere,
      },
      _sum: { total: true, subtotal: true, tax: true, serviceCharge: true },
      _count: { id: true },
    });

    const revenue = Number(revenueResult._sum.total ?? 0);
    const orderCount = revenueResult._count.id;
    const taxCollected = Number(revenueResult._sum.tax ?? 0);
    const serviceCharge = Number(revenueResult._sum.serviceCharge ?? 0);

    // Processing fee only accrues on orders that actually got charged —
    // an abandoned/unpaid QRIS order never incurred a fee.
    const processingFeeResult = await prisma.order.aggregate({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        paymentStatus: "PAID",
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
      },
      _sum: { processingFee: true },
    });
    const processingFee = Number(processingFeeResult._sum.processingFee ?? 0);

    // COGS: sum of SALE stock movements (negative qty = cost)
    // balanceAfter is not cost; use qty * material.unitCost via joining
    const cogsMovements = await prisma.stockMovement.findMany({
      where: {
        type: MovementType.SALE,
        order: {
          storeId,
          orderDate: { gte: from, lte: to },
          status: { notIn: NON_REVENUE_STATUSES },
          ...shiftWhere,
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

    // Waste loss (expired/damaged/spoiled/... inventory): shrinkage, not
    // cost-of-goods-sold for items that actually sold, so it's kept out of
    // cogs/grossProfit and only reduces the netProfit bottom line. Note: not
    // scoped by shiftWhere — WasteEntry has no shift/order linkage (v1).
    const wasteResult = await prisma.wasteEntry.aggregate({
      where: { storeId, createdAt: { gte: from, lte: to } },
      _sum: { totalValue: true },
    });
    const wasteLoss = Number(wasteResult._sum.totalValue ?? 0);

    // netRevenue excludes tax (it's the government's, not the business's) and
    // the payment-processing fee (the provider's cut). netProfit further
    // subtracts COGS and waste loss. See src/lib/finance/order-charges.ts for
    // how these amounts are computed and frozen onto each order.
    const netRevenue = revenue - taxCollected - processingFee;
    const netProfit = netRevenue - cogs - wasteLoss;

    // Daily breakdown for chart using memory grouping to avoid Prisma groupBy timezone/timestamp issues
    const rawOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
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
        wasteLoss: Math.round(wasteLoss * 100) / 100,
        taxCollected: Math.round(taxCollected * 100) / 100,
        serviceCharge: Math.round(serviceCharge * 100) / 100,
        processingFee: Math.round(processingFee * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        orderCount,
        buckets,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/summary", requireStoreAuth: true }
);
