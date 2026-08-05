/**
 * Calendar-date helpers shared by scheduling and attendance/hours reporting.
 * `StaffSchedule.date` and `AttendanceRecord`'s day-bucketing are always
 * calendar dates in the *store's business timezone* (Business.timezone),
 * never the viewer's own — a night-shift worker's "today" shouldn't shift
 * depending on who's looking at the report.
 */

import { getTimezoneOffsetMinutes } from "@/lib/utils/timezone";

/** The calendar date (in `timeZone`) that `instant` falls on, as "YYYY-MM-DD". */
export function getBusinessDateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** A "YYYY-MM-DD" date key as a plain UTC-midnight `Date` — matches how Prisma's `@db.Date` columns are read/written. */
export function businessDateKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The real UTC instant corresponding to a "HH:mm" wall-clock time on a given
 * business-local calendar date. Ignores DST-transition edge cases (same
 * approximation as getNextMidnightUTC in timezone.ts) — acceptable for
 * bucketing shift-block windows, not a scheduling-critical calculation.
 */
export function businessLocalToUTC(dateKey: string, timeHHmm: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeHHmm.split(":").map(Number);
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMin = getTimezoneOffsetMinutes(timeZone, new Date(naiveUTC));
  return new Date(naiveUTC - offsetMin * 60000);
}

/** One day added to a "YYYY-MM-DD" key. */
export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
