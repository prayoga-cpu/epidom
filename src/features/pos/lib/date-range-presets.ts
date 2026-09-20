export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export const DATE_RANGE_PRESETS: Exclude<DateRangePreset, "custom">[] = [
  "all",
  "today",
  "yesterday",
  "last7",
  "last30",
  "thisMonth",
  "lastMonth",
];

// Local calendar date (not UTC) formatted as YYYY-MM-DD, matching what
// <input type="date"> stores and what the history query params expect.
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The user's local calendar date as YYYY-MM-DD — what "today" means on their clock. */
export function localDateKey(now: Date = new Date()): string {
  return toDateInputValue(now);
}

/** A date-only `YYYY-MM-DD`, as opposed to a full ISO datetime. */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The instant a local calendar day BEGINS (00:00:00.000 on the user's clock) —
 * not UTC midnight. The two differ by the user's UTC offset, which is the whole
 * reason "today" must be built from this: at UTC+8, UTC midnight is 08:00 local,
 * so a UTC-day window files everything from 00:00–08:00 under yesterday.
 * `new Date(y, m, d)` is local time and handles DST, unlike adding a fixed offset.
 */
export function localDayStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** The last millisecond of a local calendar day (23:59:59.999 on the user's clock). */
export function localDayEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Resolve a preset to a {from, to} date-input string pair. "all"/"custom" have no computed range. */
export function resolveDateRangePreset(
  preset: DateRangePreset,
  now: Date = new Date()
): { from: string; to: string } | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: toDateInputValue(today), to: toDateInputValue(today) };
    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { from: toDateInputValue(d), to: toDateInputValue(d) };
    }
    case "last7": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: toDateInputValue(start), to: toDateInputValue(today) };
    }
    case "last30": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { from: toDateInputValue(start), to: toDateInputValue(today) };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDateInputValue(start), to: toDateInputValue(today) };
    }
    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toDateInputValue(start), to: toDateInputValue(end) };
    }
    default:
      return null;
  }
}

/** Infer which preset (if any) a given {from, to} pair currently matches — used to keep the
 * dropdown in sync when filters are cleared or restored from elsewhere (e.g. a shared link). */
export function matchDateRangePreset(from: string, to: string): DateRangePreset {
  if (!from && !to) return "all";
  for (const preset of DATE_RANGE_PRESETS) {
    if (preset === "all") continue;
    const range = resolveDateRangePreset(preset);
    if (range && range.from === from && range.to === to) return preset;
  }
  return "custom";
}

/**
 * The instant window a preset covers, on the user's own clock: from 00:00 of its
 * first day to the last millisecond of its last. `null` for "all" (unbounded) and
 * "custom" (its dates live in the caller's own state).
 */
export function resolvePresetWindow(
  preset: DateRangePreset,
  now: Date = new Date()
): { start: Date; end: Date } | null {
  const range = resolveDateRangePreset(preset, now);
  return range ? { start: localDayStart(range.from), end: localDayEnd(range.to) } : null;
}

/** Whether an ISO timestamp falls inside a preset's window. "all" and "custom" never exclude. */
export function isWithinPreset(iso: string, preset: DateRangePreset, now: Date = new Date()) {
  const window = resolvePresetWindow(preset, now);
  if (!window) return true;
  const at = new Date(iso).getTime();
  return at >= window.start.getTime() && at <= window.end.getTime();
}
