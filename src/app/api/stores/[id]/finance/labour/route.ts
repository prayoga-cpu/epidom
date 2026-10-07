/**
 * GET /api/stores/[id]/finance/labour
 *
 * Estimated labour cost for the range, from each staff member's pay setup
 * (Staff → pay type & rate) and the hours they clocked on Attendance — see
 * estimateLabourCost. It is an estimate: overtime premiums, bonuses and
 * commission pay aren't in it, and the report says so.
 *
 * Query params: from, to
 *
 * Manager/owner only, like Cash Reconciliation. Each person's pay rate and
 * cost are the OWNER's only (as on the Salary tab): a manager gets the totals —
 * labour cost, labour %, prime cost — and hours, with `payHidden: true`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { canSeeStaffPay } from "@/lib/auth/require-owner-only";
import { pairAttendanceIntoWorkdays } from "@/lib/attendance/hours-aggregation";
import { getBusinessDateKey } from "@/lib/attendance/business-date";
import { enumerateDateKeys } from "@/lib/finance/schedule-shift-bucketing";
import { reportDayRange } from "@/lib/finance/report-filters";
import { estimateLabourCost } from "@/lib/finance/insights";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;
    const gate = await requireFinanceReportAccessApi(storeId!);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
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

    const [store, staff, events] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: { standardWorkMinutesPerDay: true, business: { select: { timezone: true } } },
      }),
      // The owner's own staff row is how they work the till, not a wage.
      prisma.staffMember.findMany({
        where: { storeId, role: { not: "OWNER" } },
        select: { id: true, name: true, payType: true, payRate: true, isActive: true },
        orderBy: { name: "asc" },
      }),
      // A day either side, so a shift crossing midnight at either end pairs —
      // same window as the Attendance hours report.
      prisma.attendanceRecord.findMany({
        where: {
          storeId,
          type: { in: ["CLOCK_IN", "CLOCK_OUT"] },
          timestamp: {
            gte: new Date(from.getTime() - DAY_MS),
            lte: new Date(to.getTime() + DAY_MS),
          },
        },
        select: { id: true, staffMemberId: true, type: true, timestamp: true },
        orderBy: { timestamp: "asc" },
      }),
    ]);
    const timezone = store?.business.timezone ?? "UTC";
    const { dailyRows, missingClockOuts } = pairAttendanceIntoWorkdays(
      events,
      store?.standardWorkMinutesPerDay ?? 480,
      timezone,
      now
    );

    // The days the report asked for — not `getBusinessDateKey(to)`, which for
    // any store east of UTC turns 23:59:59Z on the last day into the next
    // day and adds a day of salary. Each worked day itself is still the
    // business-local day its clock-in fell on.
    const { fromKey, toKey } = reportDayRange(from, to);
    const worked = new Map<string, { minutes: number; days: number }>();
    for (const row of dailyRows) {
      if (row.date < fromKey || row.date > toKey) continue;
      const entry = worked.get(row.staffMemberId) ?? { minutes: 0, days: 0 };
      entry.minutes += row.totalMinutes;
      entry.days += 1;
      worked.set(row.staffMemberId, entry);
    }

    const report = estimateLabourCost(staff, worked, enumerateDateKeys(fromKey, toKey));
    const payHidden = !(await canSeeStaffPay(storeId!));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        ...report,
        // Sorted by name when hidden: the report's own order (by cost) would
        // still rank everyone's pay.
        rows: payHidden
          ? report.rows
              .map((row) => ({ ...row, payRate: null, cost: null }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : report.rows,
        payHidden,
        // Clock-ins never closed: their hours are missing from the estimate.
        missingClockOuts: missingClockOuts.filter((m) => {
          const date = getBusinessDateKey(new Date(m.clockInAt), timezone);
          return date >= fromKey && date <= toKey;
        }).length,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/labour", requireStoreAuth: true }
);
