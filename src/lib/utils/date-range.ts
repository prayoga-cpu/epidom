/**
 * Local-calendar-day date helpers shared by report date-range pickers
 * (Dashboard Analytics, Finance). Deliberately not `.toISOString()`, which
 * reads the UTC date and is off by one for any timezone ahead of UTC (e.g.
 * Asia/Jakarta) during the first hours of the local day.
 */

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverse of `toLocalISO` — parses as a local calendar day, not UTC midnight. */
export function parseLocalISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayLocalISO(): string {
  return toLocalISO(new Date());
}

export function addDaysLocalISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toLocalISO(date);
}

export function startOfMonthLocalISO(): string {
  const now = new Date();
  return toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
}

export type DateRangeLabelKey =
  | "today"
  | "yesterday"
  | "last7Days"
  | "last30Days"
  | "thisMonth"
  | "custom";

/**
 * Classifies a `from`/`to` (YYYY-MM-DD) pair against the well-known presets
 * a report date-range picker offers, so the UI can show "Today" / "Last 7
 * Days" / etc. instead of raw dates. Falls back to "custom" for anything
 * that doesn't match a preset exactly.
 */
export function describeDateRange(from: string, to: string): DateRangeLabelKey {
  const today = todayLocalISO();

  if (from === today && to === today) return "today";

  const yesterday = addDaysLocalISO(today, -1);
  if (from === yesterday && to === yesterday) return "yesterday";

  if (to === today && from === addDaysLocalISO(today, -6)) return "last7Days";
  if (to === today && from === addDaysLocalISO(today, -29)) return "last30Days";
  if (to === today && from === startOfMonthLocalISO()) return "thisMonth";

  return "custom";
}

export type DateRangePreset = Exclude<DateRangeLabelKey, "custom">;

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "thisMonth",
];

/** The inverse of `describeDateRange` — the concrete from/to for a given preset. */
export function resolveDateRangePreset(preset: DateRangePreset): { from: string; to: string } {
  const today = todayLocalISO();

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const yesterday = addDaysLocalISO(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "last7Days":
      return { from: addDaysLocalISO(today, -6), to: today };
    case "last30Days":
      return { from: addDaysLocalISO(today, -29), to: today };
    case "thisMonth":
      return { from: startOfMonthLocalISO(), to: today };
  }
}
