/**
 * One row per staff member per business day, measured against what they were
 * expected to work — the Hours tab's table and the salary report's input.
 * Pure and DB-free (the Prisma fetch lives in fetch-hours-report.ts), same
 * convention as hours-aggregation.ts, whose pairing it builds on.
 *
 * What the old Hours table could not say, and this row does:
 *  - how far over OR under the day ran (`differenceMinutes`, "+1h 2m" /
 *    "−2h 30m") instead of a dash for anything at or under the standard;
 *  - a rostered day nobody clocked in for (`noShow`) or a reported absence
 *    (`absent`) — both used to be simply missing from the table;
 *  - a day whose clock-out never happened (`missingClockOut`), which used to
 *    drop out of the table entirely, so the day looked as if it never happened.
 */

import { getBusinessDateKey, getBusinessTimeHHmm } from "./business-date";
import type { HoursAggregationResult } from "./hours-aggregation";
import { expectedDayKey, resolveExpectedDay, type ExpectedDay, type ExpectedSource } from "./expected-hours";

export type HoursDayStatus = "worked" | "onClock" | "missingClockOut" | "absent" | "noShow";

/**
 * A clock-in → clock-out stretch longer than this is almost certainly a
 * forgotten clock-out closed much later (the clock-in route refuses a second
 * clock-in while one is open, so the next day's clock-out closes yesterday's).
 * Flagged, never trimmed: the hours count as recorded, the owner decides.
 */
export const LONG_PAIR_MINUTES = 16 * 60;

export interface HoursReportPair {
  clockInAt: string;
  clockOutAt: string;
  /** "HH:mm" in the business timezone — what a manager reads on the roster. */
  clockInTime: string;
  clockOutTime: string;
  workedMinutes: number;
}

export interface HoursReportRow {
  staffMemberId: string;
  /** Business-local "YYYY-MM-DD" — the day the clock-in happened. */
  date: string;
  status: HoursDayStatus;
  pairs: HoursReportPair[];
  /** Completed clock-in → clock-out time only. */
  workedMinutes: number;
  expectedMinutes: number;
  expectedSource: ExpectedSource;
  expectedWindows: ExpectedDay["windows"];
  /**
   * worked − expected. Null while the day is incomplete — someone still on the
   * clock, or a clock-in never closed — because the worked total isn't final
   * and "−8h" would accuse someone who simply forgot to clock out.
   */
  differenceMinutes: number | null;
  /** min(worked, expected). */
  regularMinutes: number;
  /** max(0, worked − expected) — all of it on a rostered day off. */
  overtimeMinutes: number;
  /** The day's unpaired clock-in, if any — what the manager "close" correction targets. */
  openClockIn: { attendanceId: string; clockInAt: string; clockInTime: string; isOpen: boolean } | null;
  /** The person clocked in that day — what a per-day allowance counts. */
  present: boolean;
  /** A pair on this day runs past LONG_PAIR_MINUTES — check its clock-out. */
  hasLongPair: boolean;
}

export interface BuildHoursReportParams {
  aggregation: HoursAggregationResult;
  expectedDays: Map<string, ExpectedDay>;
  standardWorkMinutesPerDay: number;
  /** Inclusive business-local "YYYY-MM-DD" bounds. */
  fromKey: string;
  toKey: string;
  /** Today in the business timezone — a rostered day counts as a no-show only once it has passed. */
  todayKey: string;
  timeZone: string;
}

interface DayDraft {
  staffMemberId: string;
  date: string;
  pairs: HoursReportPair[];
  workedMinutes: number;
  openClockIn: HoursReportRow["openClockIn"];
  absent: boolean;
}

export function buildHoursReport({
  aggregation,
  expectedDays,
  standardWorkMinutesPerDay,
  fromKey,
  toKey,
  todayKey,
  timeZone,
}: BuildHoursReportParams): HoursReportRow[] {
  const inRange = (date: string) => date >= fromKey && date <= toKey;
  const drafts = new Map<string, DayDraft>();
  const draftFor = (staffMemberId: string, date: string): DayDraft => {
    const key = expectedDayKey(staffMemberId, date);
    let draft = drafts.get(key);
    if (!draft) {
      draft = { staffMemberId, date, pairs: [], workedMinutes: 0, openClockIn: null, absent: false };
      drafts.set(key, draft);
    }
    return draft;
  };

  for (const row of aggregation.dailyRows) {
    if (!inRange(row.date)) continue;
    const draft = draftFor(row.staffMemberId, row.date);
    for (const pair of row.pairs) {
      draft.pairs.push({
        clockInAt: pair.clockInAt,
        clockOutAt: pair.clockOutAt,
        clockInTime: getBusinessTimeHHmm(new Date(pair.clockInAt), timeZone),
        clockOutTime: getBusinessTimeHHmm(new Date(pair.clockOutAt), timeZone),
        workedMinutes: pair.workedMinutes,
      });
    }
    draft.workedMinutes += row.totalMinutes;
  }

  for (const missing of aggregation.missingClockOuts) {
    const clockIn = new Date(missing.clockInAt);
    const date = getBusinessDateKey(clockIn, timeZone);
    if (!inRange(date)) continue;
    const draft = draftFor(missing.staffMemberId, date);
    // Keep the latest unpaired clock-in of the day; the Hours tab's correction
    // list still carries every one of them.
    if (!draft.openClockIn || draft.openClockIn.clockInAt < missing.clockInAt) {
      draft.openClockIn = {
        attendanceId: missing.attendanceId,
        clockInAt: missing.clockInAt,
        clockInTime: getBusinessTimeHHmm(clockIn, timeZone),
        isOpen: missing.isOpen,
      };
    }
  }

  for (const absence of aggregation.absences) {
    if (!inRange(absence.date)) continue;
    draftFor(absence.staffMemberId, absence.date).absent = true;
  }

  // A rostered shift nobody clocked in for — only once the day is over, so a
  // shift that hasn't started yet is never reported as missed.
  for (const [key, expected] of expectedDays) {
    if (expected.source !== "roster") continue;
    const separator = key.lastIndexOf(":");
    const staffMemberId = key.slice(0, separator);
    const date = key.slice(separator + 1);
    if (!inRange(date) || date >= todayKey) continue;
    draftFor(staffMemberId, date);
  }

  const rows: HoursReportRow[] = [];
  for (const draft of drafts.values()) {
    const expected = resolveExpectedDay(
      expectedDays,
      draft.staffMemberId,
      draft.date,
      standardWorkMinutesPerDay
    );
    const hasPairs = draft.pairs.length > 0;
    const status: HoursDayStatus = draft.openClockIn?.isOpen
      ? "onClock"
      : draft.openClockIn
        ? "missingClockOut"
        : hasPairs
          ? "worked"
          : draft.absent
            ? "absent"
            : "noShow";

    draft.pairs.sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
    rows.push({
      staffMemberId: draft.staffMemberId,
      date: draft.date,
      status,
      pairs: draft.pairs,
      workedMinutes: draft.workedMinutes,
      expectedMinutes: expected.minutes,
      expectedSource: expected.source,
      expectedWindows: expected.windows,
      differenceMinutes: draft.openClockIn ? null : draft.workedMinutes - expected.minutes,
      regularMinutes: Math.min(draft.workedMinutes, expected.minutes),
      overtimeMinutes: Math.max(0, draft.workedMinutes - expected.minutes),
      openClockIn: draft.openClockIn,
      present: hasPairs || draft.openClockIn !== null,
      hasLongPair: draft.pairs.some((p) => p.workedMinutes > LONG_PAIR_MINUTES),
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.staffMemberId.localeCompare(b.staffMemberId));
  return rows;
}
