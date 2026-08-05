/**
 * Pure, DB-free working-hours/overtime aggregation — pairs raw
 * AttendanceRecord clock events into completed workdays. Kept separate from
 * Prisma so it's directly unit-testable (see __tests__/hours-aggregation.test.ts),
 * matching the convention in src/lib/finance/report-aggregation.ts.
 */

import { getBusinessDateKey } from "./business-date";

export type AttendanceEventType = "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE";

export interface AttendanceEventInput {
  id: string;
  staffMemberId: string;
  type: AttendanceEventType;
  timestamp: Date | string;
}

export interface CompletedPair {
  staffMemberId: string;
  /** Business-local calendar date ("YYYY-MM-DD") the pair is attributed to — the day the CLOCK_IN happened, even if CLOCK_OUT crosses midnight. */
  date: string;
  clockInAt: string;
  clockOutAt: string;
  workedMinutes: number;
}

export interface MissingClockOut {
  /** The open CLOCK_IN record's own id — what the manager "close" endpoint (POST /attendance/[attendanceId]/close) targets. */
  attendanceId: string;
  staffMemberId: string;
  clockInAt: string;
  /** true if this clock-in is still open at "now" (within the queried range) rather than confirmed missing. */
  isOpen: boolean;
}

export interface OrphanClockOut {
  staffMemberId: string;
  clockOutAt: string;
}

export interface AbsenceDay {
  staffMemberId: string;
  date: string;
  timestamp: string;
}

export interface DailyHoursRow {
  staffMemberId: string;
  date: string;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  pairs: CompletedPair[];
}

export interface HoursAggregationResult {
  dailyRows: DailyHoursRow[];
  missingClockOuts: MissingClockOut[];
  orphanClockOuts: OrphanClockOut[];
  absences: AbsenceDay[];
}

/**
 * Pairs a staff member's clock events into completed workdays.
 *
 * - A second CLOCK_IN while one is already open closes the stale one as a
 *   `missingClockOut` (excluded from totals) rather than guessing a
 *   clock-out time, then opens the new one.
 * - A CLOCK_OUT pairs with the nearest open CLOCK_IN; with none open it's an
 *   orphan (excluded from totals).
 * - A completed pair is attributed to the calendar date its CLOCK_IN
 *   happened on (business timezone) — this is what makes a cross-midnight
 *   shift (e.g. 20:00→04:00) work with zero special-casing: it's simply one
 *   ~8h entry on the day it started.
 * - Still-open at the end of the event list: flagged `isOpen: true` if `now`
 *   is within the same clock-in's date, otherwise a plain missing-clock-out.
 */
export function pairAttendanceIntoWorkdays(
  events: AttendanceEventInput[],
  standardWorkMinutesPerDay: number,
  timeZone: string,
  now: Date = new Date()
): HoursAggregationResult {
  const byStaff = new Map<string, AttendanceEventInput[]>();
  for (const event of events) {
    const list = byStaff.get(event.staffMemberId) ?? [];
    list.push(event);
    byStaff.set(event.staffMemberId, list);
  }

  const dailyRowMap = new Map<string, DailyHoursRow>();
  const missingClockOuts: MissingClockOut[] = [];
  const orphanClockOuts: OrphanClockOut[] = [];
  const absences: AbsenceDay[] = [];

  for (const [staffMemberId, staffEvents] of byStaff) {
    const sorted = [...staffEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let openClockIn: { id: string; timestamp: Date } | null = null;

    for (const event of sorted) {
      const ts = new Date(event.timestamp);

      if (event.type === "CLOCK_IN") {
        if (openClockIn) {
          missingClockOuts.push({
            attendanceId: openClockIn.id,
            staffMemberId,
            clockInAt: openClockIn.timestamp.toISOString(),
            isOpen: false,
          });
        }
        openClockIn = { id: event.id, timestamp: ts };
        continue;
      }

      if (event.type === "CLOCK_OUT") {
        if (!openClockIn) {
          orphanClockOuts.push({ staffMemberId, clockOutAt: ts.toISOString() });
          continue;
        }
        const workedMinutes = Math.round((ts.getTime() - openClockIn.timestamp.getTime()) / 60000);
        const date = getBusinessDateKey(openClockIn.timestamp, timeZone);
        const key = `${staffMemberId}:${date}`;
        const row = dailyRowMap.get(key) ?? {
          staffMemberId,
          date,
          totalMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          pairs: [],
        };
        row.pairs.push({
          staffMemberId,
          date,
          clockInAt: openClockIn.timestamp.toISOString(),
          clockOutAt: ts.toISOString(),
          workedMinutes,
        });
        row.totalMinutes += workedMinutes;
        dailyRowMap.set(key, row);
        openClockIn = null;
        continue;
      }

      // ABSENCE — independent, never paired.
      absences.push({
        staffMemberId,
        date: getBusinessDateKey(ts, timeZone),
        timestamp: ts.toISOString(),
      });
    }

    if (openClockIn) {
      const stillToday =
        getBusinessDateKey(openClockIn.timestamp, timeZone) === getBusinessDateKey(now, timeZone);
      missingClockOuts.push({
        attendanceId: openClockIn.id,
        staffMemberId,
        clockInAt: openClockIn.timestamp.toISOString(),
        isOpen: stillToday,
      });
    }
  }

  const dailyRows = Array.from(dailyRowMap.values()).map((row) => ({
    ...row,
    regularMinutes: Math.min(row.totalMinutes, standardWorkMinutesPerDay),
    overtimeMinutes: Math.max(0, row.totalMinutes - standardWorkMinutesPerDay),
  }));
  dailyRows.sort((a, b) => a.date.localeCompare(b.date) || a.staffMemberId.localeCompare(b.staffMemberId));

  return { dailyRows, missingClockOuts, orphanClockOuts, absences };
}
