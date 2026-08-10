/**
 * GET /api/stores/[id]/storefront/analytics
 *
 * Returns storefront visitor/engagement/conversion analytics for a date
 * range: unique visitors (+ trend vs. the prior period), page/menu/item
 * views, WhatsApp-click conversion, storefront-attributed orders/revenue,
 * a daily chart series, and the most-viewed menu items.
 *
 * Query params:
 *   from — ISO date (default: start of current month)
 *   to   — ISO date (default: now)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storefrontService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { computeTrend, computeRate } from "@/lib/utils/storefront-metrics";

export const dynamic = "force-dynamic";

interface DailyBucket {
  date: string;
  uniqueVisitors: number;
  pageViews: number;
  menuViews: number;
  whatsappClicks: number;
  orders: number;
}

async function countUniqueVisitors(storefrontId: string, from: Date, to: Date): Promise<number> {
  const rows = await prisma.storefrontEvent.findMany({
    where: { storefrontId, type: "VIEW", createdAt: { gte: from, lte: to } },
    select: { visitorHash: true },
  });
  return new Set(rows.map((r) => r.visitorHash)).size;
}

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = new Date(searchParams.get("from") ?? defaultFrom.toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);

    // Prior period of equal length, immediately before `from` — gives a real
    // visitor trend instead of a hardcoded percentage.
    const rangeMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);

    const [events, prevUniqueVisitors, orderTotals, rawOrders] = await Promise.all([
      prisma.storefrontEvent.findMany({
        where: { storefrontId: storefront.id, createdAt: { gte: from, lte: to } },
        select: { type: true, visitorHash: true, menuItemId: true, menuItemName: true, createdAt: true },
      }),
      countUniqueVisitors(storefront.id, prevFrom, prevTo),
      prisma.order.aggregate({
        where: {
          storeId,
          source: "STOREFRONT",
          status: { notIn: NON_REVENUE_STATUSES },
          orderDate: { gte: from, lte: to },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.findMany({
        where: {
          storeId,
          source: "STOREFRONT",
          status: { notIn: NON_REVENUE_STATUSES },
          orderDate: { gte: from, lte: to },
        },
        select: { orderDate: true },
      }),
    ]);

    const visitorHashesByDay = new Map<string, Set<string>>();
    const buckets = new Map<string, DailyBucket>();
    const itemViewCounts = new Map<string, { menuItemName: string; count: number }>();

    let pageViews = 0;
    let menuViews = 0;
    let whatsappClicks = 0;

    const getBucket = (dateKey: string): DailyBucket => {
      let bucket = buckets.get(dateKey);
      if (!bucket) {
        bucket = { date: dateKey, uniqueVisitors: 0, pageViews: 0, menuViews: 0, whatsappClicks: 0, orders: 0 };
        buckets.set(dateKey, bucket);
      }
      return bucket;
    };

    for (const event of events) {
      const dateKey = event.createdAt.toISOString().split("T")[0];
      const bucket = getBucket(dateKey);

      if (event.type === "VIEW") {
        pageViews += 1;
        bucket.pageViews += 1;
        const daySet = visitorHashesByDay.get(dateKey) ?? new Set<string>();
        daySet.add(event.visitorHash);
        visitorHashesByDay.set(dateKey, daySet);
      } else if (event.type === "MENU_VIEW") {
        menuViews += 1;
        bucket.menuViews += 1;
      } else if (event.type === "WHATSAPP_CLICK") {
        whatsappClicks += 1;
        bucket.whatsappClicks += 1;
      } else if (event.type === "ITEM_VIEW" && event.menuItemId) {
        const existing = itemViewCounts.get(event.menuItemId);
        itemViewCounts.set(event.menuItemId, {
          menuItemName: event.menuItemName ?? existing?.menuItemName ?? "Unknown item",
          count: (existing?.count ?? 0) + 1,
        });
      }
    }

    for (const [dateKey, daySet] of visitorHashesByDay) {
      getBucket(dateKey).uniqueVisitors = daySet.size;
    }

    for (const order of rawOrders) {
      const dateKey = order.orderDate.toISOString().split("T")[0];
      getBucket(dateKey).orders += 1;
    }

    const uniqueVisitors = new Set(
      events.filter((e) => e.type === "VIEW").map((e) => e.visitorHash)
    ).size;

    const visitorTrend = computeTrend(uniqueVisitors, prevUniqueVisitors);

    const storefrontOrders = orderTotals._count.id;
    const storefrontRevenue = Math.round(Number(orderTotals._sum.total ?? 0) * 100) / 100;

    const rate = (numerator: number) => computeRate(numerator, uniqueVisitors);

    const topViewedItems = Array.from(itemViewCounts.entries())
      .map(([menuItemId, v]) => ({ menuItemId, menuItemName: v.menuItemName, viewCount: v.count }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5);

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        uniqueVisitors,
        visitorTrend,
        pageViews,
        menuViews,
        menuViewRate: rate(menuViews),
        whatsappClicks,
        chatConversionRate: rate(whatsappClicks),
        storefrontOrders,
        storefrontRevenue,
        orderConversionRate: rate(storefrontOrders),
        dailyBuckets: Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date)),
        topViewedItems,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/storefront/analytics", requireStoreAuth: true }
);
