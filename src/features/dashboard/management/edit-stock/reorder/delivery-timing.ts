/**
 * The status an open supplier order shows, worked out from its expected
 * delivery date. Nobody sets it by hand: it moves from "on the way" to "due
 * today" to "late" as the days pass, until the merchant taps Received.
 */
export type DeliveryTiming =
  | { kind: "upcoming"; days: number }
  | { kind: "dueToday" }
  | { kind: "late"; days: number }
  | { kind: "noDate" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The calendar day an expected date names, as local midnight.
 *
 * Two write paths store it differently. The create dialogs send the
 * `<input type="date">` value ("2026-09-25"), which the API stores as UTC
 * midnight. The edit dialog sends a calendar pick's local midnight as ISO,
 * which lands mid-day UTC for any timezone other than UTC. Reading the first
 * with local parts shifts it a day west of UTC, and reading the second with
 * UTC parts shifts it a day east of UTC, so pick the parts by shape.
 */
export function expectedCalendarDay(value: string | Date): Date {
  const d = new Date(value);
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  return isUtcMidnight
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getDeliveryTiming(
  expected: string | Date | null | undefined,
  now: Date = new Date()
): DeliveryTiming {
  if (!expected) return { kind: "noDate" };
  const expectedDay = expectedCalendarDay(expected);
  if (Number.isNaN(expectedDay.getTime())) return { kind: "noDate" };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // round, not floor: a DST switch makes one day 23 or 25 hours long.
  const days = Math.round((expectedDay.getTime() - today.getTime()) / DAY_MS);

  if (days > 0) return { kind: "upcoming", days };
  if (days === 0) return { kind: "dueToday" };
  return { kind: "late", days: -days };
}

/** Tomorrow as `YYYY-MM-DD` in local time: the default expected delivery date. */
export function tomorrowDateInput(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
