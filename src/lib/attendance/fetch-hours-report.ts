import { prisma } from "@/lib/prisma";
import { pairAttendanceIntoWorkdays, type MissingClockOut } from "./hours-aggregation";
import { buildExpectedDays } from "./expected-hours";
import { buildHoursReport, type HoursReportRow } from "./hours-report";
import { addDaysToDateKey, businessDateKeyToDate, getBusinessDateKey } from "./business-date";
import { applyOvertimeDecisions } from "./overtime-approval";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A `from`/`to` query param as a business-local "YYYY-MM-DD". A bare date key
 * is taken as-is: running it through `new Date()` and back into the business
 * timezone shifts it a day for any store west of UTC (and the print page's
 * old `T23:59:59Z` end did the same east of it). A full ISO datetime is still
 * accepted, read as the business day it falls on.
 */
export function toBusinessDateKey(value: string | null, fallback: string, timeZone: string): string | null {
  if (!value) return fallback;
  if (DATE_KEY.test(value)) return value;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : getBusinessDateKey(instant, timeZone);
}

/** Longest range a report will price — a year, plus slack for a leap year and month edges. */
const MAX_RANGE_DAYS = 400;

/**
 * The report range from `from`/`to` query params: the current month to date
 * when absent, null when unreadable, reversed or longer than MAX_RANGE_DAYS.
 */
export function resolveReportRange(
  searchParams: URLSearchParams,
  timeZone: string,
  now: Date = new Date()
): { fromKey: string; toKey: string; todayKey: string } | null {
  const todayKey = getBusinessDateKey(now, timeZone);
  const fromKey = toBusinessDateKey(searchParams.get("from"), `${todayKey.slice(0, 8)}01`, timeZone);
  const toKey = toBusinessDateKey(searchParams.get("to"), todayKey, timeZone);
  if (!fromKey || !toKey || toKey < fromKey) return null;
  const span = (businessDateKeyToDate(toKey).getTime() - businessDateKeyToDate(fromKey).getTime()) / 86_400_000;
  if (span > MAX_RANGE_DAYS) return null;
  return { fromKey, toKey, todayKey };
}

export interface StoreHoursSettings {
  timeZone: string;
  standardWorkMinutesPerDay: number;
  /** Overtime is paid only once approved — see overtime-approval.ts. */
  overtimeRequiresApproval: boolean;
}

export async function getStoreHoursSettings(storeId: string): Promise<StoreHoursSettings> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      standardWorkMinutesPerDay: true,
      overtimeRequiresApproval: true,
      business: { select: { timezone: true } },
    },
  });
  return {
    timeZone: store?.business.timezone ?? "UTC",
    standardWorkMinutesPerDay: store?.standardWorkMinutesPerDay ?? 480,
    overtimeRequiresApproval: store?.overtimeRequiresApproval ?? false,
  };
}

export interface FetchHoursReportParams {
  storeId: string;
  fromKey: string;
  toKey: string;
  staffId?: string | null;
  settings: StoreHoursSettings;
  now?: Date;
}

export interface HoursReportResult {
  rows: HoursReportRow[];
  /** Every unpaired clock-in whose day is in range — the Hours tab's correction list. */
  missingClockOuts: (MissingClockOut & { date: string })[];
}

/**
 * The Hours tab's rows and the salary report's input, from one query path so
 * the two can never disagree. Attendance is read with a two-day pad on each
 * side so a clock-in near the range's edge still pairs with a clock-out past
 * midnight; rows are then cut back to the requested days. Each row's overtime
 * is resolved against the store's approval decisions when approval is on.
 */
export async function fetchHoursReport({
  storeId,
  fromKey,
  toKey,
  staffId,
  settings,
  now = new Date(),
}: FetchHoursReportParams): Promise<HoursReportResult> {
  const { timeZone, standardWorkMinutesPerDay, overtimeRequiresApproval } = settings;
  const dateRange = { gte: businessDateKeyToDate(fromKey), lte: businessDateKeyToDate(toKey) };

  const [events, roster, decisions] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        storeId,
        type: { in: ["CLOCK_IN", "CLOCK_OUT", "ABSENCE"] },
        ...(staffId && { staffMemberId: staffId }),
        timestamp: {
          gte: businessDateKeyToDate(addDaysToDateKey(fromKey, -2)),
          lt: businessDateKeyToDate(addDaysToDateKey(toKey, 3)),
        },
      },
      select: { id: true, staffMemberId: true, type: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.staffSchedule.findMany({
      where: {
        storeId,
        status: "PUBLISHED",
        ...(staffId && { staffMemberId: staffId }),
        date: dateRange,
      },
      select: {
        staffMemberId: true,
        date: true,
        isDayOff: true,
        customStartTime: true,
        customEndTime: true,
        scheduleShift: { select: { startTime: true, endTime: true } },
      },
    }),
    // Not read while approval is off: every overtime minute is paid then.
    overtimeRequiresApproval
      ? prisma.overtimeApproval.findMany({
          where: { storeId, ...(staffId && { staffMemberId: staffId }), date: dateRange },
          select: {
            staffMemberId: true,
            date: true,
            decision: true,
            minutes: true,
            approvedMinutes: true,
            decidedAt: true,
            decidedByName: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const aggregation = pairAttendanceIntoWorkdays(events, standardWorkMinutesPerDay, timeZone, now);
  const expectedDays = buildExpectedDays(
    roster.map((entry) => ({
      staffMemberId: entry.staffMemberId,
      // @db.Date reads back as UTC midnight of the stored calendar day.
      date: entry.date.toISOString().slice(0, 10),
      isDayOff: entry.isDayOff,
      startTime: entry.scheduleShift?.startTime ?? entry.customStartTime,
      endTime: entry.scheduleShift?.endTime ?? entry.customEndTime,
    }))
  );

  const rows = applyOvertimeDecisions(
    buildHoursReport({
      aggregation,
      expectedDays,
      standardWorkMinutesPerDay,
      fromKey,
      toKey,
      todayKey: getBusinessDateKey(now, timeZone),
      timeZone,
    }),
    decisions.map((d) => ({
      staffMemberId: d.staffMemberId,
      // @db.Date reads back as UTC midnight of the stored calendar day.
      date: d.date.toISOString().slice(0, 10),
      decision: d.decision,
      minutes: d.minutes,
      approvedMinutes: d.approvedMinutes,
      decidedAt: d.decidedAt.toISOString(),
      decidedByName: d.decidedByName,
    })),
    overtimeRequiresApproval
  );

  const missingClockOuts = aggregation.missingClockOuts
    .map((m) => ({ ...m, date: getBusinessDateKey(new Date(m.clockInAt), timeZone) }))
    .filter((m) => m.date >= fromKey && m.date <= toKey);

  return { rows, missingClockOuts };
}
