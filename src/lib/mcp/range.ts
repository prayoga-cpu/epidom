import { z } from "zod";
import {
  addDaysToDateKey,
  businessLocalToUTC,
  getBusinessDateKey,
  mondayOfDateKey,
} from "@/lib/attendance/business-date";
import { McpToolError } from "./errors";

/**
 * Report periods for the Claude connector, resolved in the business's own
 * timezone (Business.timezone): "yesterday" for a Jakarta café means
 * yesterday in Jakarta, whoever asks and wherever the server runs.
 *
 * Ranges are inclusive at both ends — `to` is the last millisecond of the
 * last day — because computeStoreFinanceSummary and the order queries filter
 * with `gte from / lte to`.
 */

export const PERIODS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
  "custom",
] as const;
export type Period = (typeof PERIODS)[number];

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("A calendar date in the business's timezone, YYYY-MM-DD.");

/** The period arguments a report tool accepts. */
export const periodInput = {
  period: z
    .enum(PERIODS)
    .default("today")
    .describe(
      "Which days to cover, in the business's timezone. Weeks run Monday to Sunday. Use custom with from/to for anything else."
    ),
  from: dateKey.optional().describe("First day (YYYY-MM-DD), only with period: custom."),
  to: dateKey.optional().describe("Last day, inclusive (YYYY-MM-DD), only with period: custom."),
};

export interface ResolvedRange {
  /** First instant of the first day. */
  from: Date;
  /** Last instant of the last day (inclusive). */
  to: Date;
  /** First and last calendar days, YYYY-MM-DD, inclusive. */
  fromKey: string;
  toKey: string;
  timezone: string;
}

function periodError(message: string): McpToolError {
  return new McpToolError("INVALID_PERIOD", message);
}

/** Longest custom range a report accepts, so one call can't scan years of orders. */
export const MAX_RANGE_DAYS = 366;

function startOfDay(key: string, timezone: string): Date {
  return businessLocalToUTC(key, "00:00", timezone);
}

/** The inclusive range for calendar days fromKey..toKey in `timezone`. */
export function rangeFromKeys(fromKey: string, toKey: string, timezone: string): ResolvedRange {
  if (fromKey > toKey) throw periodError("`from` must be on or before `to`.");
  const days = daysBetween(fromKey, toKey) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw periodError(`A report covers at most ${MAX_RANGE_DAYS} days; ask for a shorter range.`);
  }
  return {
    from: startOfDay(fromKey, timezone),
    to: new Date(startOfDay(addDaysToDateKey(toKey, 1), timezone).getTime() - 1),
    fromKey,
    toKey,
    timezone,
  };
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000
  );
}

function firstOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

function lastOfMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${key.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Calendar days for a named period, as of `now` in `timezone`. */
export function periodKeys(
  period: Exclude<Period, "custom">,
  timezone: string,
  now: Date = new Date()
): { fromKey: string; toKey: string } {
  const today = getBusinessDateKey(now, timezone);
  switch (period) {
    case "today":
      return { fromKey: today, toKey: today };
    case "yesterday": {
      const y = addDaysToDateKey(today, -1);
      return { fromKey: y, toKey: y };
    }
    case "this_week":
      return { fromKey: mondayOfDateKey(today), toKey: today };
    case "last_week": {
      const monday = addDaysToDateKey(mondayOfDateKey(today), -7);
      return { fromKey: monday, toKey: addDaysToDateKey(monday, 6) };
    }
    case "this_month":
      return { fromKey: firstOfMonth(today), toKey: today };
    case "last_month": {
      const lastDay = addDaysToDateKey(firstOfMonth(today), -1);
      return { fromKey: firstOfMonth(lastDay), toKey: lastDay };
    }
    case "last_7_days":
      return { fromKey: addDaysToDateKey(today, -6), toKey: today };
    case "last_30_days":
      return { fromKey: addDaysToDateKey(today, -29), toKey: today };
  }
}

/** Resolve a tool's period arguments. */
export function resolveRange(
  input: { period?: Period; from?: string; to?: string },
  timezone: string,
  now: Date = new Date()
): ResolvedRange {
  const period = input.period ?? "today";
  if (period === "custom") {
    if (!input.from || !input.to) {
      throw periodError("period: custom needs both `from` and `to` (YYYY-MM-DD).");
    }
    return rangeFromKeys(input.from, input.to, timezone);
  }
  const { fromKey, toKey } = periodKeys(period, timezone, now);
  return rangeFromKeys(fromKey, toKey, timezone);
}

/**
 * The period to compare against, like for like:
 * - a week: the same weekdays one week earlier ("this week so far", Mon–Wed,
 *   against last Mon–Wed);
 * - a month: the same number of days from the start of the previous month,
 *   capped at its last day (Oct 1–15 against Sep 1–15);
 * - anything else: the same number of days just before it.
 */
export function previousRange(period: Period, current: ResolvedRange): ResolvedRange {
  const { fromKey, toKey, timezone } = current;
  if (period === "this_week" || period === "last_week") {
    return rangeFromKeys(addDaysToDateKey(fromKey, -7), addDaysToDateKey(toKey, -7), timezone);
  }
  if (period === "this_month" || period === "last_month") {
    const prevMonthLast = addDaysToDateKey(fromKey, -1);
    const prevFrom = firstOfMonth(prevMonthLast);
    // Same number of elapsed days, capped at the end of that month.
    const elapsed = daysBetween(fromKey, toKey);
    const candidate = addDaysToDateKey(prevFrom, elapsed);
    const prevTo = candidate > lastOfMonth(prevFrom) ? lastOfMonth(prevFrom) : candidate;
    return rangeFromKeys(prevFrom, prevTo, timezone);
  }
  const days = daysBetween(fromKey, toKey) + 1;
  const prevTo = addDaysToDateKey(fromKey, -1);
  return rangeFromKeys(addDaysToDateKey(prevTo, -(days - 1)), prevTo, timezone);
}
