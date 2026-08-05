import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { pairAttendanceIntoWorkdays } from "@/lib/attendance/hours-aggregation";
import { getBusinessDateKey } from "@/lib/attendance/business-date";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/stores/[id]/attendance/hours?from&to&staffId?
 *
 * Computed working-hours/overtime report. Queries attendance events with a
 * 1-day pad on each side of the requested range so a clock-in near a day
 * boundary correctly pairs with a clock-out that lands after midnight, then
 * filters the *output* rows back down to the requested window.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { standardWorkMinutesPerDay: true, business: { select: { timezone: true } } },
    });
    const timezone = store?.business.timezone ?? "UTC";
    const standardWorkMinutesPerDay = store?.standardWorkMinutesPerDay ?? 480;

    const events = await prisma.attendanceRecord.findMany({
      where: {
        storeId,
        type: { in: ["CLOCK_IN", "CLOCK_OUT", "ABSENCE"] },
        ...(staffId && { staffMemberId: staffId }),
        timestamp: { gte: new Date(from.getTime() - DAY_MS), lte: new Date(to.getTime() + DAY_MS) },
      },
      select: { id: true, staffMemberId: true, type: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    });

    const result = pairAttendanceIntoWorkdays(events, standardWorkMinutesPerDay, timezone, now);

    const fromKey = getBusinessDateKey(from, timezone);
    const toKey = getBusinessDateKey(to, timezone);
    const inRange = (date: string) => date >= fromKey && date <= toKey;

    const staffIds = [...new Set(events.map((e) => e.staffMemberId))];
    const staff = await prisma.staffMember.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, name: true, role: true },
    });
    const staffMap = new Map(staff.map((s) => [s.id, s]));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        standardWorkMinutesPerDay,
        dailyRows: result.dailyRows
          .filter((row) => inRange(row.date))
          .map((row) => ({ ...row, staff: staffMap.get(row.staffMemberId) ?? null })),
        missingClockOuts: result.missingClockOuts.map((m) => ({
          ...m,
          staff: staffMap.get(m.staffMemberId) ?? null,
        })),
        orphanClockOuts: result.orphanClockOuts.map((o) => ({
          ...o,
          staff: staffMap.get(o.staffMemberId) ?? null,
        })),
        absences: result.absences
          .filter((a) => inRange(a.date))
          .map((a) => ({ ...a, staff: staffMap.get(a.staffMemberId) ?? null })),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/hours", requireStoreAuth: true }
);
