/**
 * Minute counts as "1h 2m" — and, for a difference against the expected
 * hours, "+1h 2m" / "−2h 30m". Units come from the locale (`h`/`m` in
 * English, `j`/`m` in Indonesian) so callers pass them in; the defaults are
 * for print and tests.
 */

export interface DurationUnits {
  hour: string;
  minute: string;
}

const DEFAULT_UNITS: DurationUnits = { hour: "h", minute: "m" };

/** "8h", "45m", "1h 2m", "0m". Rounds to whole minutes; negative input is read as its size. */
export function formatDuration(minutes: number, units: DurationUnits = DEFAULT_UNITS): string {
  const total = Math.round(Math.abs(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}${units.minute}`;
  if (m === 0) return `${h}${units.hour}`;
  return `${h}${units.hour} ${m}${units.minute}`;
}

/**
 * "+1h 2m" over, "−2h 30m" under (a true minus sign, which screen readers say
 * as "minus"), "0m" exactly on target.
 */
export function formatSignedDuration(minutes: number, units: DurationUnits = DEFAULT_UNITS): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return formatDuration(0, units);
  return `${rounded > 0 ? "+" : "−"}${formatDuration(rounded, units)}`;
}
