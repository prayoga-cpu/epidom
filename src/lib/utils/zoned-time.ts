/**
 * Wall-clock ↔ instant conversion in a named IANA zone, for times a person
 * schedules ("Tuesday 10:00, Paris time"). Unlike the midnight helper in
 * ./timezone, this one is exact across DST changes: it corrects its first
 * guess with the offset at the guessed instant.
 */
import { getTimezoneOffsetMinutes } from "./timezone";

/**
 * The instant at which the clock in `timeZone` reads `date` ("YYYY-MM-DD")
 * `time` ("HH:mm"). A time skipped by a spring-forward lands an hour later;
 * a time that happens twice at a fall-back resolves to its second occurrence.
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimezoneOffsetMinutes(timeZone, new Date(wallAsUtc));
  const guess = wallAsUtc - firstOffset * 60_000;
  const secondOffset = getTimezoneOffsetMinutes(timeZone, new Date(guess));
  return new Date(secondOffset === firstOffset ? guess : wallAsUtc - secondOffset * 60_000);
}

/** The date ("YYYY-MM-DD") and time ("HH:mm") the clock in `timeZone` shows at `instant`. */
export function utcToZonedWallTime(
  instant: Date | string,
  timeZone: string
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(instant));
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${hour}:${map.minute}` };
}
