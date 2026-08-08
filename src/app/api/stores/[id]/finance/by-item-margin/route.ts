/**
 * GET /api/stores/[id]/finance/by-item-margin
 *
 * Per-menu-item profitability (revenue minus cost) using the frozen
 * OrderItem.unitCostSnapshot taken at sale time. Items sold before that
 * field existed, or with no COGS attribution path (aggregator-imported
 * items with no productId), report cost/margin as unknown ("—") rather
 * than a silently-wrong number — see buildItemMarginRows.
 *
 * Query params: from, to, staffId, shiftId, category, department, channel, paymentMethod
 */
import { NextResponse } from "next/server";
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
import { buildItemMarginRows } from "@/lib/finance/report-aggregation";
import { storefrontService } from "@/lib/services/storefront.service";

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
          ...channelFilter(searchParams.get("channel")),
          ...paymentMethodFilter(searchParams.get("paymentMethod")),
        },
        // Combined via AND, same reasoning as top-items: both filters can
        // independently produce their own "OR" clause.
        AND: [
          categoryFilter(searchParams.get("category")),
          departmentFilter(searchParams.get("department")),
        ],
      },
      select: { name: true, quantity: true, total: true, unitCostSnapshot: true },
    });

    // item.total is already literal in the owner's own currency;
    // unitCostSnapshot is a frozen copy of Product.costPrice, stored in IDR
    // (the platform base currency) — convert before buildItemMarginRows
    // combines them into a margin, or the result mixes units for any
    // non-IDR store.
    const { rate: ownerRate } = await storefrontService.getOwnerCurrencyAndRate(storeId!);

    const rows = buildItemMarginRows(
      items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        total: Number(item.total),
        unitCostSnapshot:
          item.unitCostSnapshot != null
            ? storefrontService.convertBaseToOwnerSync(Number(item.unitCostSnapshot), ownerRate)
            : null,
      }))
    );

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), items: rows })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-item-margin", requireStoreAuth: true }
);
