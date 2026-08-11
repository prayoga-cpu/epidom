/**
 * "Who is on the clock right now" — derived from raw clock events rather than
 * stored as state, for the same reason the attendance audit trail never edits
 * a record: the event log is the source of truth (see AttendanceRecord's
 * schema comment, and the per-staff `/attendance/status` endpoint this
 * generalizes to a whole store).
 *
 * There is no DB-level "one open clock-in" constraint, so a staff member is
 * considered on duty when their most recent CLOCK_IN/CLOCK_OUT event is a
 * CLOCK_IN. Callers feed in a bounded recent window of events; a clock-in
 * older than that window is a forgotten clock-out, which the Hours & Overtime
 * report already surfaces as `missingClockOuts` — not someone still working.
 */

/** Structural mirror of Prisma's `AttendanceType` — kept local so this module stays client-safe. */
export interface AttendanceEventLike {
  staffMemberId: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE";
  timestamp: Date;
}

/**
 * The newest event per staff member. Order-independent — it compares
 * timestamps rather than trusting the caller's `orderBy`.
 */
export function latestEventPerStaff<E extends AttendanceEventLike>(events: E[]): Map<string, E> {
  const latest = new Map<string, E>();

  for (const event of events) {
    const current = latest.get(event.staffMemberId);
    if (!current) {
      latest.set(event.staffMemberId, event);
      continue;
    }

    const delta = event.timestamp.getTime() - current.timestamp.getTime();
    // On an exact-timestamp tie the non-CLOCK_IN event wins: showing a phantom
    // "still on duty" row on a monitoring surface is worse than under-reporting.
    if (delta > 0 || (delta === 0 && event.type !== "CLOCK_IN")) {
      latest.set(event.staffMemberId, event);
    }
  }

  return latest;
}

/** The events of every staff member whose latest event is an open CLOCK_IN. */
export function deriveOnDuty<E extends AttendanceEventLike>(events: E[]): E[] {
  return [...latestEventPerStaff(events).values()].filter((event) => event.type === "CLOCK_IN");
}

/** Staff member ids with at least one CLOCK_IN at or after `since`. */
export function staffClockedInSince<E extends AttendanceEventLike>(
  events: E[],
  since: Date
): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type === "CLOCK_IN" && event.timestamp.getTime() >= since.getTime()) {
      ids.add(event.staffMemberId);
    }
  }
  return ids;
}
