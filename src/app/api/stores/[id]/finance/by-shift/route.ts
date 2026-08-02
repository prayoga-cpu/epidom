/**
 * GET /api/stores/[id]/finance/by-shift
 *
 * The "total sales from open to close" report — revenue and order count
 * per cashier shift session within a date range. Orders placed outside a
 * POS session (storefront/online, shiftId null) are bucketed under
 * "Unassigned" rather than dropped.
 *
 * Query params: from, to, staffId
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { buildShiftRows } from "@/lib/finance/report-aggregation";

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

    const grouped = await prisma.order.groupBy({
      by: ["shiftId"],
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...(staffId && { shift: { staffMemberId: staffId } }),
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const shiftIds = grouped.map((g) => g.shiftId).filter((id): id is string => id !== null);
    const shifts = await prisma.shift.findMany({
      where: { id: { in: shiftIds } },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });
    const rows = buildShiftRows(grouped, shifts);

    return NextResponse.json(
      createSuccessResponse({ from: from.toISOString(), to: to.toISOString(), shifts: rows })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-shift", requireStoreAuth: true }
);
