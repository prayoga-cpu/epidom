/**
 * Timezone-aware "next midnight" calculation, dependency-free (no
 * date-fns-tz/luxon — just Intl.DateTimeFormat, which already knows every
 * IANA zone). Ignores DST-transition edge cases (off by an hour at most,
 * twice a year) — acceptable for a UX-timed session boundary, not a
 * scheduling-critical calculation.
 */

/** Offset of `timeZone` from UTC, in minutes, at the given instant. */
export function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) === 24 ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return (asUTC - date.getTime()) / 60000;
}

/**
 * Human-readable UTC offset for `timeZone` (e.g. "GMT+7") — used to tell
 * users which clock the midnight session-expiry above is measured against,
 * since it's the store's business timezone, not the viewer's own.
 */
export function getTimezoneOffsetLabel(timeZone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
}

/** The next local midnight (00:00:00) in `timeZone`, as a real UTC instant. */
export function getNextMidnightUTC(timeZone: string, from: Date = new Date()): Date {
  const offsetMin = getTimezoneOffsetMinutes(timeZone, from);
  const local = new Date(from.getTime() + offsetMin * 60000);
  const nextLocalMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return new Date(nextLocalMidnight - offsetMin * 60000);
}
