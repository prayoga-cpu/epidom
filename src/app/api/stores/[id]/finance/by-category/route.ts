/**
 * GET /api/stores/[id]/finance/by-category
 *
 * Revenue breakdown by menu display category (e.g. "Appetizers", "Cold
 * Drinks" — the storefront's own menu sections) for a date range. For the
 * Kitchen/Bar team-reporting split, see `by-department`. Items whose menu
 * item has no category — or aggregator-imported orders, which never carry
 * a menuItemId — are bucketed under "Uncategorized" rather than dropped.
 *
 * Query params: from, to, staffId, shiftId
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { bucketItemsByCategory } from "@/lib/finance/report-aggregation";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requireFinanceReportAccessApi(storeId!);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const shiftWhere = shiftFilter(searchParams);

    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          storeId,
          status: { notIn: NON_REVENUE_STATUSES },
          orderDate: { gte: from, lte: to },
          ...shiftWhere,
          ...channelFilter(searchParams.get("channel")),
          ...paymentMethodFilter(searchParams.get("paymentMethod")),
        },
      },
      select: {
        orderId: true,
        total: true,
        quantity: true,
        menuItem: { select: { category: { select: { id: true, name: true } } } },
      },
    });

    const categories = bucketItemsByCategory(
      items.map((item) => ({
        orderId: item.orderId,
        total: Number(item.total),
        quantity: Number(item.quantity),
        menuItem: item.menuItem,
      }))
    );

    // An order with a drink and a dessert sits in two categories, so the
    // per-category order counts don't add up to the period's orders — the
    // total is counted once per order here instead of summed in the browser.
    const totals = {
      orderCount: new Set(items.map((item) => item.orderId)).size,
      totalQuantity:
        Math.round(categories.reduce((sum, c) => sum + c.totalQuantity, 0) * 100) / 100,
      totalRevenue:
        Math.round(categories.reduce((sum, c) => sum + c.totalRevenue, 0) * 100) / 100,
    };

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), categories, totals })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-category", requireStoreAuth: true }
);
