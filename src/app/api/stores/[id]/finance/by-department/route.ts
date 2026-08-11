/**
 * GET /api/stores/[id]/finance/by-department
 *
 * Revenue split by Kitchen/Bar(/Custom) team for a date range — the "how
 * much did Kitchen sell vs. Bar today" report. Items whose menu item has no
 * department set — or aggregator-imported orders, which never carry a
 * menuItemId — are bucketed under "Unassigned" rather than dropped.
 * CUSTOM-productLine items (the optional second product line — see
 * Product.productLine) get their own real "CUSTOM" bucket, labeled
 * client-side with the store's own Store.customProductsLabel.
 *
 * Query params: from, to, staffId, shiftId
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter } from "@/lib/finance/report-filters";
import { bucketItemsByDepartment, type DepartmentValue } from "@/lib/finance/report-aggregation";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
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
        },
      },
      select: {
        total: true,
        quantity: true,
        menuItem: {
          select: { department: true, product: { select: { productLine: true } } },
        },
      },
    });

    const departments = bucketItemsByDepartment(
      items.map((item) => ({
        total: Number(item.total),
        quantity: Number(item.quantity),
        // MenuItem.department is drawn from the shared Department enum but,
        // unlike Material, a MenuItem is never assigned "BOTH" — it always
        // routes to exactly one KDS station. CUSTOM-productLine items (the
        // optional second product line — see Product.productLine) have no
        // real Kitchen/Bar department of their own — their stored department
        // stays at its inert schema default — so they're routed to the
        // client-facing "CUSTOM" bucket instead of their real DB value.
        menuItem: !item.menuItem
          ? null
          : {
              department: (item.menuItem.product?.productLine === "CUSTOM"
                ? "CUSTOM"
                : item.menuItem.department) as DepartmentValue,
            },
      }))
    );

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), departments })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-department", requireStoreAuth: true }
);
