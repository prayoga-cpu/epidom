/**
 * GET /api/stores/[id]/finance/channels
 *
 * Returns per-channel P&L with commission deductions — see
 * lib/finance/channel-report.ts.
 *
 * Query params: from, to, staffId, shiftId, paymentMethod
 */
import { NextResponse } from "next/server";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { shiftFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { loadChannelRows } from "@/lib/finance/channel-report";

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

    const channels = await loadChannelRows(
      storeId!,
      { from, to },
      { ...shiftFilter(searchParams), ...paymentMethodFilter(searchParams.get("paymentMethod")) }
    );

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), channels })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/channels", requireStoreAuth: true }
);
