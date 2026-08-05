/**
 * GET /api/stores/[id]/finance/by-waste-reason
 *
 * Waste-loss breakdown by reason for a date range, for the Finance report's
 * Waste tab. Note: unlike the other finance sub-reports, this does NOT
 * accept a staff/shift filter — WasteEntry has no shift/order linkage (see
 * WasteEntry model comment), so it can't be scoped that way yet.
 *
 * Query params: from, to
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { bucketWasteByReason } from "@/lib/finance/report-aggregation";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());

    const entries = await prisma.wasteEntry.findMany({
      where: { storeId, createdAt: { gte: from, lte: to } },
      select: { reason: true, customReason: true, quantity: true, totalValue: true },
    });

    const reasons = bucketWasteByReason(
      entries.map((e) => ({
        reason: e.reason,
        customReason: e.customReason,
        quantity: Number(e.quantity),
        totalValue: Number(e.totalValue),
      }))
    );

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), reasons })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-waste-reason", requireStoreAuth: true }
);
