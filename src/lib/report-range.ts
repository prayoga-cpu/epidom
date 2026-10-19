/**
 * A custom range on the admin reports (/admin/sales-pages, /admin/pixel) and
 * the partner page: whole days picked on a calendar, both ends included,
 * carried in the URL as `range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`.
 *
 * Days are UTC days, like the Pixel report's day-by-day table
 * (date_trunc('day') in the database), so a day means the same thing
 * everywhere on these pages, whoever opens them.
 */

export interface CustomDays {
  /** First day, YYYY-MM-DD. */
  from: string;
  /** Last day (included), YYYY-MM-DD. */
  to: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-19" → that day's UTC midnight, or null when it isn't a real date ("2026-02-30"). */
function utcDay(value: string | undefined): Date | null {
  if (!value || !ISO_DAY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Date rolls 2026-02-30 over to March: only a value that round-trips is a day.
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** The `from`/`to` query params as a custom range, or null when either is missing or not a day. Reversed ends are swapped. */
export function parseCustomDays(from?: string, to?: string): CustomDays | null {
  const a = utcDay(from);
  const b = utcDay(to);
  if (!a || !b) return null;
  return a <= b ? { from: from!, to: to! } : { from: to!, to: from! };
}

/** Database bounds: from the first day's midnight (UTC) up to, not including, the midnight after the last day. */
export function customDayBounds(days: CustomDays): { gte: Date; lt: Date } {
  const gte = utcDay(days.from)!;
  const lt = new Date(utcDay(days.to)!.getTime() + DAY_MS);
  return { gte, lt };
}

/**
 * What a report page reads from its URL: a preset, or `custom` with valid
 * days. `custom` without them falls back to the page's default preset, so a
 * hand-edited URL never shows an empty or broken report.
 */
export function resolveReportRange<R extends string>(
  preset: R | "custom",
  params: { from?: string; to?: string },
  fallback: R
): R | CustomDays {
  if (preset !== "custom") return preset;
  return parseCustomDays(params.from, params.to) ?? fallback;
}

/** The query string for a custom range, for links that keep it (`range=custom&from=…&to=…`). */
export function customRangeQuery(days: CustomDays): string {
  return `range=custom&from=${days.from}&to=${days.to}`;
}
