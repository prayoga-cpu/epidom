/**
 * GET /api/stores/[id]/customers/analytics
 *
 * Returns customer counts and top spenders for a date range.
 *
 * Query params:
 *   from  — ISO date (default: start of current month)
 *   to    — ISO date (default: now)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
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

    const inRange = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
      },
      select: { customerName: true, customerPhone: true, total: true, orderDate: true },
      orderBy: { orderDate: "asc" },
    });

    const anonymousOrders = inRange.filter((o) => o.customerPhone == null).length;

    // Group identified (phone-bearing) orders by phone; keep the latest name per phone
    const groups = new Map<
      string,
      { phone: string; name: string; orderCount: number; totalSpend: number; latest: Date }
    >();
    for (const o of inRange) {
      if (o.customerPhone == null) continue;
      const existing = groups.get(o.customerPhone);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpend += Number(o.total ?? 0);
        if (o.orderDate >= existing.latest) {
          existing.name = o.customerName;
          existing.latest = o.orderDate;
        }
      } else {
        groups.set(o.customerPhone, {
          phone: o.customerPhone,
          name: o.customerName,
          orderCount: 1,
          totalSpend: Number(o.total ?? 0),
          latest: o.orderDate,
        });
      }
    }

    const inRangePhones = Array.from(groups.keys());
    const uniqueCustomers = inRangePhones.length;

    // Returning customers: identified phones that also ordered before the range
    const priorGroups = inRangePhones.length
      ? await prisma.order.groupBy({
          by: ["customerPhone"],
          where: {
            storeId,
            status: { notIn: NON_REVENUE_STATUSES },
            orderDate: { lt: from },
            customerPhone: { in: inRangePhones },
          },
          _count: { id: true },
        })
      : [];

    const returningCustomers = priorGroups.length;
    const newCustomers = uniqueCustomers - returningCustomers;

    const topCustomers = Array.from(groups.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10)
      .map((g) => ({
        name: g.name,
        phone: g.phone,
        orderCount: g.orderCount,
        totalSpend: Math.round(g.totalSpend * 100) / 100,
      }));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        uniqueCustomers,
        anonymousOrders,
        newCustomers,
        returningCustomers,
        topCustomers,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/customers/analytics", requireStoreAuth: true }
);
