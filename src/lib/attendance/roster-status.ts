/**
 * Today's published roster measured against actual attendance — the "who was
 * expected and isn't here" half of the dashboard's live operations card. The
 * other half (who *is* on the clock) is derived from raw clock events in
 * on-duty.ts.
 */

import { businessLocalToUTC } from "./business-date";

export interface LateRosterOptions<R> {
  /** "HH:mm" in the store's business timezone, or null when the row has no fixed start. */
  startTimeOf: (row: R) => string | null;
  /** Staff already accounted for today — on the clock now, or clocked in earlier. */
  attended: Set<string>;
  now: Date;
  /** "YYYY-MM-DD" business-local date the roster rows belong to. */
  businessDate: string;
  timeZone: string;
  /** Minutes past the rostered start before someone counts as late, not just starting. */
  graceMinutes: number;
}

export interface LateRosterEntry<R> {
  row: R;
  /** The resolved "HH:mm" start — non-null by construction, so callers don't re-derive it. */
  startTime: string;
  minutesLate: number;
}

/**
 * Roster rows whose start time has passed by more than `graceMinutes` and
 * whose staff member has no clock-in today, latest arrival first.
 *
 * A row with no resolvable start time is skipped rather than assumed late —
 * `StaffSchedule` allows a shift-block reference *or* a custom time range, and
 * a row carrying neither has no start to be late against.
 */
export function selectLateRoster<R extends { staffMemberId: string }>(
  rows: R[],
  options: LateRosterOptions<R>
): LateRosterEntry<R>[] {
  const { startTimeOf, attended, now, businessDate, timeZone, graceMinutes } = options;

  return rows
    .map((row) => {
      const startTime = startTimeOf(row);
      if (!startTime) return null;
      if (attended.has(row.staffMemberId)) return null;

      const startsAt = businessLocalToUTC(businessDate, startTime, timeZone);
      const minutesLate = Math.floor((now.getTime() - startsAt.getTime()) / 60000);
      if (minutesLate < graceMinutes) return null;

      return { row, startTime, minutesLate };
    })
    .filter((entry): entry is LateRosterEntry<R> => entry !== null)
    .sort((a, b) => b.minutesLate - a.minutesLate);
}
