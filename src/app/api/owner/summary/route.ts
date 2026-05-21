/**
 * GET /api/owner/summary
 *
 * Aggregates metrics across all stores in the authenticated user's business.
 * Gated to ENTERPRISE plan.
 *
 * Returns per-store revenue breakdown + rolled-up totals for the given date range.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { OrderStatus, SubscriptionPlan } from "@prisma/client";

const PLAN_ORDER: SubscriptionPlan[] = ["FREE", "POS", "OPERATIONS", "ENTERPRISE"];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });
  }

  const userId = session.user.id;

  // Check ENTERPRISE plan
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const plan = subscription?.plan ?? "FREE";
  if (PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf("ENTERPRISE")) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Owner summary requires ENTERPRISE plan"),
      { status: 403 }
    );
  }

  const business = await prisma.business.findUnique({
    where: { userId },
    include: { stores: { select: { id: true, name: true, image: true } } },
  });

  if (!business) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "No business found"), { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const from = new Date(searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  const to = new Date(searchParams.get("to") ?? now.toISOString());

  // Per-store revenue in parallel
  const storeMetrics = await Promise.all(
    business.stores.map(async (store) => {
      const [agg, orderCount] = await Promise.all([
        prisma.order.aggregate({
          where: {
            storeId: store.id,
            status: { notIn: [OrderStatus.CANCELLED] },
            orderDate: { gte: from, lte: to },
          },
          _sum: { total: true },
          _count: { id: true },
        }),
        prisma.order.count({
          where: {
            storeId: store.id,
            status: OrderStatus.PENDING,
          },
        }),
      ]);

      return {
        storeId: store.id,
        name: store.name,
        image: store.image,
        revenue: Math.round(Number(agg._sum.total ?? 0) * 100) / 100,
        orderCount: agg._count.id,
        pendingOrders: orderCount,
      };
    })
  );

  const totalRevenue = storeMetrics.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = storeMetrics.reduce((s, m) => s + m.orderCount, 0);
  const totalPending = storeMetrics.reduce((s, m) => s + m.pendingOrders, 0);

  // Sort by revenue descending
  storeMetrics.sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json(
    createSuccessResponse({
      from: from.toISOString(),
      to: to.toISOString(),
      businessName: business.name,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalPending,
      storeCount: business.stores.length,
      stores: storeMetrics,
    })
  );
}
