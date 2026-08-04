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

/** Resolve a preset to a {from, to} date-input string pair. "all"/"custom" have no computed range. */
export function resolveDateRangePreset(
  preset: DateRangePreset
): { from: string; to: string } | null {
  const now = new Date();
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
