import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { operationsGuard } from "@/lib/auth/require-feature";
import { deriveOnDuty, staffClockedInSince } from "@/lib/attendance/on-duty";
import { selectLateRoster } from "@/lib/attendance/roster-status";
import {
  addDaysToDateKey,
  businessLocalToUTC,
  businessDateKeyToDate,
  getBusinessDateKey,
} from "@/lib/attendance/business-date";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far back to read clock events when deciding who is on the clock. A
 * clock-in older than this is a forgotten clock-out (the Hours & Overtime
 * report's `missingClockOuts`), not someone still working — see on-duty.ts.
 */
const ON_DUTY_LOOKBACK_DAYS = 7;

/**
 * Ceiling on events read for that window. Ordered newest-first, so the cap
 * only ever drops the *oldest* events — a staff member whose last clock event
 * is older than 500 store-wide events is conservatively treated as off duty.
 */
const MAX_EVENTS = 500;

/** Minutes past a rostered start before someone counts as late, not just starting. */
const LATE_GRACE_MINUTES = 5;

/**
 * GET /api/stores/[id]/operations/status
 *
 * Live operations snapshot for the dashboard's monitoring card: who is on the
 * clock, which POS till sessions are open, and how today's roster is tracking
 * against actual attendance. Read-only aggregate of data the Schedule page
 * already owns — manager/owner only, matching the attendance audit trail, and
 * OPERATIONS-plan only, matching the Schedule/Production pages it summarizes.
 */
export const GET = withApiHandler(
  async (_request, { storeId, userId }) => {
    const planGate = await operationsGuard(userId, "Operations monitoring");
    if (planGate) return planGate;

    const roleGate = await requireManagerOrOwnerApi(storeId!);
    if (roleGate) return roleGate;

    const now = new Date();

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { business: { select: { timezone: true } } },
    });
    // Day bucketing follows the store's business timezone, never the viewer's
    // — a night-shift clock-in shouldn't land on a different "today"
    // depending on who opens the dashboard.
    const timezone = store?.business.timezone ?? "UTC";
    const businessDate = getBusinessDateKey(now, timezone);
    const dayStart = businessLocalToUTC(businessDate, "00:00", timezone);
    const dayEnd = businessLocalToUTC(addDaysToDateKey(businessDate, 1), "00:00", timezone);

    const [events, openTills, rosterToday, absentToday] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          storeId,
          type: { in: ["CLOCK_IN", "CLOCK_OUT"] },
          timestamp: { gte: new Date(now.getTime() - ON_DUTY_LOOKBACK_DAYS * DAY_MS) },
          staffMember: { isActive: true },
        },
        select: {
          id: true,
          staffMemberId: true,
          type: true,
          timestamp: true,
          locationLabel: true,
          staffMember: { select: { id: true, name: true, role: true, customRoleLabel: true } },
          staffSchedule: { select: { scheduleShift: { select: { name: true } } } },
        },
        orderBy: { timestamp: "desc" },
        take: MAX_EVENTS,
      }),
      prisma.shift.findMany({
        where: { storeId, closedAt: null },
        select: {
          id: true,
          openedAt: true,
          openingCash: true,
          staffMember: { select: { id: true, name: true, role: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { openedAt: "asc" },
      }),
      // Only PUBLISHED rows: a draft roster is still being edited, so holding
      // anyone to it as "expected in" would flag noise.
      prisma.staffSchedule.findMany({
        where: {
          storeId,
          date: businessDateKeyToDate(businessDate),
          isDayOff: false,
          status: "PUBLISHED",
          staffMember: { isActive: true },
        },
        select: {
          id: true,
          staffMemberId: true,
          customStartTime: true,
          staffMember: { select: { id: true, name: true, role: true, customRoleLabel: true } },
          scheduleShift: { select: { name: true, startTime: true } },
        },
      }),
      prisma.attendanceRecord.count({
        where: { storeId, type: "ABSENCE", timestamp: { gte: dayStart, lt: dayEnd } },
      }),
    ]);

    const onDutyEvents = deriveOnDuty(events);
    const onDutyIds = new Set(onDutyEvents.map((event) => event.staffMemberId));
    const clockedInToday = staffClockedInSince(events, dayStart);

    const onDuty = onDutyEvents
      .map((event) => ({
        staffMemberId: event.staffMemberId,
        name: event.staffMember.name,
        role: event.staffMember.role,
        customRoleLabel: event.staffMember.customRoleLabel,
        since: event.timestamp.toISOString(),
        locationLabel: event.locationLabel,
        shiftName: event.staffSchedule?.scheduleShift?.name ?? null,
      }))
      .sort((a, b) => a.since.localeCompare(b.since));

    // Rostered, their start time has passed, and still no clock-in today.
    const late = selectLateRoster(rosterToday, {
      startTimeOf: (row) => row.scheduleShift?.startTime ?? row.customStartTime,
      attended: new Set([...onDutyIds, ...clockedInToday]),
      now,
      businessDate,
      timeZone: timezone,
      graceMinutes: LATE_GRACE_MINUTES,
    }).map(({ row, startTime, minutesLate }) => ({
      staffMemberId: row.staffMemberId,
      name: row.staffMember.name,
      role: row.staffMember.role,
      customRoleLabel: row.staffMember.customRoleLabel,
      shiftName: row.scheduleShift?.name ?? null,
      startTime,
      minutesLate,
    }));

    return NextResponse.json(
      createSuccessResponse({
        now: now.toISOString(),
        timezone,
        businessDate,
        onDuty,
        openTills: openTills.map((till) => ({
          id: till.id,
          staffMemberId: till.staffMember.id,
          name: till.staffMember.name,
          role: till.staffMember.role,
          openedAt: till.openedAt.toISOString(),
          // Literal in the store's own currency, like every other
          // Order/Shift-derived amount — never an IDR value to convert.
          openingCash: Number(till.openingCash),
          orderCount: till._count.orders,
        })),
        late,
        today: {
          scheduledCount: rosterToday.length,
          onDutyCount: onDuty.length,
          clockedInCount: clockedInToday.size,
          absentCount: absentToday,
          openTillCount: openTills.length,
          lateCount: late.length,
        },
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/operations/status", requireStoreAuth: true }
);
