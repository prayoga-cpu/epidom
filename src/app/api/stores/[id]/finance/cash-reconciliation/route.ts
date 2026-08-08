/**
 * GET /api/stores/[id]/finance/cash-reconciliation
 *
 * Per-cashier-session cash-drawer reconciliation — opening/closing/expected
 * cash and the over/short difference, already recorded when a Shift closes
 * (see src/app/api/stores/[id]/pos/shifts/[shiftId]/close, if present) but
 * never previously surfaced on a Finance report. Query params: from, to, staffId
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { buildCashReconciliationRows } from "@/lib/finance/report-aggregation";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const staffId = searchParams.get("staffId");

    const shifts = await prisma.shift.findMany({
      where: {
        storeId,
        openedAt: { gte: from, lte: to },
        ...(staffId && { staffMemberId: staffId }),
      },
      include: { staffMember: { select: { id: true, name: true } } },
    });

    const rows = buildCashReconciliationRows(shifts);

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), shifts: rows })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/cash-reconciliation", requireStoreAuth: true }
);
