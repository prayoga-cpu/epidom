/**
 * GET /api/stores/[id]/finance/cash-reconciliation
 *
 * Per-cashier-session cash-drawer reconciliation. Every session's position is
 * recomputed live from `getShiftCashOnHand` rather than read off the frozen
 * `Shift.expectedCash` / `Shift.cashDifference` columns, which are only written
 * at close (so an open till had nothing to show) and which predate tips, float
 * top-ups, paid-outs and safe drops being part of the arithmetic at all.
 *
 * Query params: from, to, staffId
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { buildCashReconciliationRows } from "@/lib/finance/report-aggregation";
import { getShiftCashOnHand } from "@/lib/services/cash-drawer.service";

/** Ceiling on sessions per request — see the `take` below. */
const MAX_RECONCILED_SESSIONS = 200;

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
      orderBy: { openedAt: "desc" },
      // Each session costs three scoped queries below, so an unbounded range
      // would fan out 3N. Newest-first with a ceiling: a month of two-till
      // days is ~60 sessions, and nobody reconciles a drawer from row 200.
      take: MAX_RECONCILED_SESSIONS,
    });

    // One pass over the sessions, all in flight together — the per-category
    // split comes out of a single `getShiftCashOnHand` call per shift, never a
    // query per category.
    const inputs = await Promise.all(
      shifts.map(async (shift) => ({
        id: shift.id,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        staffMember: shift.staffMember,
        breakdown: await getShiftCashOnHand(storeId!, shift),
      }))
    );

    const rows = buildCashReconciliationRows(inputs);

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), shifts: rows })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/cash-reconciliation", requireStoreAuth: true }
);
