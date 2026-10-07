/**
 * How long each staff member was EXPECTED to work on a given business day —
 * the baseline the Hours tab's "+1h 2m" / "−2h 30m" difference and the
 * salary report's overtime are measured against. Pure and DB-free, same
 * convention as hours-aggregation.ts.
 *
 * The published roster wins: a 4-hour part-time block expects 4 hours, a
 * split 08:00–10:00 + 14:00–16:00 day expects 4, a day off expects 0. Only a
 * day with no published roster row falls back to the store-wide
 * `standardWorkMinutesPerDay`, so a store that never builds a roster sees the
 * same baseline it always had. Drafts never count — they are the manager's
 * work in progress, the same rule clock-in uses to link a roster row.
 */

export type ExpectedSource = "roster" | "dayOff" | "standard";

export interface RosterEntryInput {
  staffMemberId: string;
  /** Business-local "YYYY-MM-DD". */
  date: string;
  isDayOff: boolean;
  /** "HH:mm", from the shift block or the custom range; null when the row has neither. */
  startTime: string | null;
  endTime: string | null;
}

export interface ExpectedDay {
  minutes: number;
  source: ExpectedSource;
  /** The rostered windows, for display ("08:00–16:00"). Empty for "standard" and "dayOff". */
  windows: { start: string; end: string }[];
}

const DAY_MINUTES = 24 * 60;

function parseHHmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Minutes between two "HH:mm" times. An end at or before the start crosses
 * midnight (ScheduleShift's own convention: "20:00" → "04:00" is 8 hours).
 * Null when either time is unreadable.
 */
export function rosterWindowMinutes(start: string, end: string): number | null {
  const startMinutes = parseHHmm(start);
  const endMinutes = parseHHmm(end);
  if (startMinutes === null || endMinutes === null) return null;
  const span = endMinutes - startMinutes;
  return span > 0 ? span : span + DAY_MINUTES;
}

export function expectedDayKey(staffMemberId: string, date: string): string {
  return `${staffMemberId}:${date}`;
}

/**
 * Folds published roster rows into one expected day per staff member and
 * date. Timed rows add up (a split shift is several rows); a day whose rows
 * are all days off expects 0. A row with neither a day off nor readable times
 * says nothing and is skipped, leaving that day to the store standard.
 */
export function buildExpectedDays(entries: RosterEntryInput[]): Map<string, ExpectedDay> {
  const days = new Map<string, ExpectedDay>();

  for (const entry of entries) {
    const key = expectedDayKey(entry.staffMemberId, entry.date);
    const current = days.get(key);

    if (entry.isDayOff) {
      if (!current) days.set(key, { minutes: 0, source: "dayOff", windows: [] });
      continue;
    }

    if (!entry.startTime || !entry.endTime) continue;
    const minutes = rosterWindowMinutes(entry.startTime, entry.endTime);
    if (minutes === null) continue;

    // A timed row outranks a day-off row for the same date: the manager put
    // the person on a shift, whatever else is left on the grid.
    const base = current?.source === "roster" ? current : { minutes: 0, source: "roster" as const, windows: [] };
    days.set(key, {
      minutes: base.minutes + minutes,
      source: "roster",
      windows: [...base.windows, { start: entry.startTime, end: entry.endTime }].sort((a, b) =>
        a.start.localeCompare(b.start)
      ),
    });
  }

  return days;
}

/** The expected day for one staff member and date, falling back to the store standard. */
export function resolveExpectedDay(
  days: Map<string, ExpectedDay>,
  staffMemberId: string,
  date: string,
  standardWorkMinutesPerDay: number
): ExpectedDay {
  return (
    days.get(expectedDayKey(staffMemberId, date)) ?? {
      minutes: standardWorkMinutesPerDay,
      source: "standard",
      windows: [],
    }
  );
}
