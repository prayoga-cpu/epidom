/**
 * GET /api/stores/[id]/finance/top-items
 *
 * Returns top-selling items by revenue and quantity for a date range.
 * Query params: from, to, limit (default 10), includeTotals ("1" adds
 * `totals` — every matching line, not just the top `limit`, so the report
 * can show what the list leaves out).
 */
import { NextResponse } from "next/server";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import {
  shiftFilter,
  categoryFilter,
  departmentFilter,
  channelFilter,
  paymentMethodFilter,
} from "@/lib/finance/report-filters";
import { loadTopItems } from "@/lib/finance/top-items";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

    const { items, totals } = await loadTopItems(storeId!, {
      window: { from, to },
      orderFilters: {
        ...shiftFilter(searchParams),
        ...channelFilter(searchParams.get("channel")),
        ...paymentMethodFilter(searchParams.get("paymentMethod")),
      },
      itemFilters: [
        categoryFilter(searchParams.get("category")),
        departmentFilter(searchParams.get("department")),
      ],
      limit,
      // Opt-in: the dashboard and storefront cards only want the top few.
      includeTotals: searchParams.get("includeTotals") === "1",
    });

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        items,
        ...(totals && { totals }),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/top-items", requireStoreAuth: true }
);
