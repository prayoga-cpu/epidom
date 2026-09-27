import { COUNTRIES } from "@/lib/onboarding/markets";
import type { SearchSelectOption } from "@/features/stores/shared/search-select";

/**
 * Used when the runtime has no Intl.supportedValuesOf (older Safari): every
 * zone of the countries Epidom lists, plus the big ones elsewhere.
 */
export const FALLBACK_TIMEZONES: readonly string[] = Array.from(
  new Set([
    "UTC",
    ...COUNTRIES.flatMap((country) => country.timezones),
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "America/Argentina/Buenos_Aires",
    "America/Bogota",
    "America/Lima",
    "America/Mexico_City",
    "America/Sao_Paulo",
    "Asia/Bangkok",
    "Asia/Hong_Kong",
    "Asia/Ho_Chi_Minh",
    "Asia/Kolkata",
    "Asia/Manila",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Europe/Athens",
    "Europe/Istanbul",
    "Europe/Moscow",
    "Europe/Stockholm",
    "Europe/Warsaw",
    "Pacific/Auckland",
  ])
);

/** Every IANA zone the runtime knows (fallback list otherwise), always including "UTC". */
export function listTimezones(): string[] {
  let zones: string[] = [];
  try {
    const supportedValuesOf = (
      Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }
    ).supportedValuesOf;
    if (typeof supportedValuesOf === "function") zones = supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  if (zones.length === 0) zones = [...FALLBACK_TIMEZONES];
  return Array.from(new Set(["UTC", ...zones]));
}

/**
 * Offsets by zone and UTC hour. Building a formatter per zone costs ~0.5 ms,
 * so the ~400-zone list took a few hundred ms each time it was rebuilt (every
 * country change in the business dialog); an offset only changes on the hour.
 */
const offsetCache = new Map<string, string | undefined>();
const OFFSET_CACHE_MAX = 4000;

/** "UTC+02:00" for the zone at `date` (now by default); undefined when Intl can't tell. */
export function timezoneOffsetLabel(timezone: string, date: Date = new Date()): string | undefined {
  const key = `${timezone}@${Math.floor(date.getTime() / 3_600_000)}`;
  if (offsetCache.has(key)) return offsetCache.get(key);
  const label = computeOffsetLabel(timezone, date);
  if (offsetCache.size >= OFFSET_CACHE_MAX) offsetCache.clear();
  offsetCache.set(key, label);
  return label;
}

function computeOffsetLabel(timezone: string, date: Date): string | undefined {
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    if (!name) return undefined;
    // longOffset writes a zero offset as a bare "GMT".
    if (name === "GMT" || name === "UTC") return "UTC+00:00";
    return name.replace(/^GMT/, "UTC");
  } catch {
    return undefined;
  }
}

/** "Europe/Paris (UTC+02:00)", underscores shown as spaces ("America/New York"). */
export function formatTimezoneLabel(timezone: string, date?: Date): string {
  const name = timezone.replace(/_/g, " ");
  const offset = timezoneOffsetLabel(timezone, date);
  return offset ? `${name} (${offset})` : name;
}

/**
 * Options for the business timezone picker, alphabetical. `suggested` zones
 * (the business country's) come first in their own section. The current value
 * is always listed, even an alias the runtime's list doesn't carry.
 */
export function buildTimezoneOptions(input: {
  current?: string | null;
  suggested?: readonly string[];
  zones?: readonly string[];
  date?: Date;
}): SearchSelectOption[] {
  const all = new Set(input.zones ?? listTimezones());
  if (input.current) all.add(input.current);
  const suggested = new Set((input.suggested ?? []).filter((zone) => all.has(zone)));

  const toOption = (zone: string): SearchSelectOption => {
    const offset = timezoneOffsetLabel(zone, input.date);
    const spaced = zone.replace(/_/g, " ");
    const city = spaced.split("/").slice(1).join(" ");
    return {
      value: zone,
      label: offset ? `${spaced} (${offset})` : spaced,
      keywords: [zone, spaced, ...(city ? [city] : []), ...(offset ? [offset] : [])],
      section: suggested.has(zone) ? 0 : 1,
    };
  };

  return [...all].sort((a, b) => a.localeCompare(b)).map(toOption);
}
