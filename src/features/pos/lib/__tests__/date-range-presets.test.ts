import { describe, it, expect, afterEach } from "vitest";
import {
  DATE_ONLY,
  isWithinPreset,
  localDateKey,
  localDayEnd,
  localDayStart,
  resolveDateRangePreset,
  resolvePresetWindow,
} from "../date-range-presets";

// The whole point of these helpers is WHICH CLOCK a "day" is measured on, so most
// tests pin the process timezone. (Vitest runs each file in its own process, so
// setting TZ is safe; it is restored anyway.)
const ORIGINAL_TZ = process.env.TZ;
const inTimezone = (tz: string) => {
  process.env.TZ = tz;
};
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("localDayStart / localDayEnd — the user's day, not UTC's", () => {
  it("Jakarta (UTC+7): the day begins at 17:00Z the evening before", () => {
    inTimezone("Asia/Jakarta");
    expect(localDayStart("2026-09-19").toISOString()).toBe("2026-09-18T17:00:00.000Z");
    expect(localDayEnd("2026-09-19").toISOString()).toBe("2026-09-19T16:59:59.999Z");
  });

  it("Makassar (UTC+8): the day begins at 16:00Z the evening before", () => {
    inTimezone("Asia/Makassar");
    expect(localDayStart("2026-09-19").toISOString()).toBe("2026-09-18T16:00:00.000Z");
    expect(localDayEnd("2026-09-19").toISOString()).toBe("2026-09-19T15:59:59.999Z");
  });

  it("Los Angeles (UTC−7 in September): the day begins at 07:00Z", () => {
    inTimezone("America/Los_Angeles");
    expect(localDayStart("2026-09-19").toISOString()).toBe("2026-09-19T07:00:00.000Z");
    expect(localDayEnd("2026-09-19").toISOString()).toBe("2026-09-20T06:59:59.999Z");
  });

  it("UTC: the two clocks agree", () => {
    inTimezone("UTC");
    expect(localDayStart("2026-09-19").toISOString()).toBe("2026-09-19T00:00:00.000Z");
    expect(localDayEnd("2026-09-19").toISOString()).toBe("2026-09-19T23:59:59.999Z");
  });

  it("is DST-correct: the day the clocks go back is 25 hours long (a fixed offset would say 24)", () => {
    inTimezone("Europe/Paris"); // 2026-10-25, 03:00 → 02:00
    const ms = localDayEnd("2026-10-25").getTime() - localDayStart("2026-10-25").getTime();
    expect(ms).toBe(25 * 3_600_000 - 1);
  });

  it("recognises a date-only value, and not a datetime", () => {
    expect(DATE_ONLY.test("2026-09-19")).toBe(true);
    expect(DATE_ONLY.test("2026-09-19T17:00:00.000Z")).toBe(false);
    expect(DATE_ONLY.test("")).toBe(false);
  });
});

describe("localDateKey", () => {
  it("is the date on the user's clock, not the UTC date", () => {
    // 20:00Z on the 19th is already 03:00 on the 20th in Jakarta.
    inTimezone("Asia/Jakarta");
    expect(localDateKey(new Date("2026-09-19T20:00:00Z"))).toBe("2026-09-20");
    inTimezone("UTC");
    expect(localDateKey(new Date("2026-09-19T20:00:00Z"))).toBe("2026-09-19");
  });
});

describe("isWithinPreset('today') — 00:00 on the user's own clock", () => {
  // 03:00 on Sunday 20 Sept in Jakarta, while it is still the 19th in UTC.
  const NOW = new Date("2026-09-19T20:00:00Z");

  it("counts the small hours as today, even though UTC still calls them yesterday", () => {
    inTimezone("Asia/Jakarta");
    // 01:00 on the 20th, Jakarta. The old UTC-day window filed this under the 19th.
    expect(isWithinPreset("2026-09-19T18:00:00.000Z", "today", NOW)).toBe(true);
  });

  it("puts 23:00 the evening before in yesterday", () => {
    inTimezone("Asia/Jakarta");
    expect(isWithinPreset("2026-09-19T16:00:00.000Z", "today", NOW)).toBe(false);
  });

  it("is exact at midnight: 00:00:00.000 is in, one millisecond earlier is out", () => {
    inTimezone("Asia/Jakarta");
    expect(isWithinPreset("2026-09-19T17:00:00.000Z", "today", NOW)).toBe(true);
    expect(isWithinPreset("2026-09-19T16:59:59.999Z", "today", NOW)).toBe(false);
  });

  it("is exact at the end of the day too, and excludes the next day", () => {
    inTimezone("Asia/Jakarta");
    expect(isWithinPreset("2026-09-20T16:59:59.999Z", "today", NOW)).toBe(true);
    expect(isWithinPreset("2026-09-20T17:00:00.000Z", "today", NOW)).toBe(false);
  });

  it("the same instant is a different day for a viewer in another zone", () => {
    const order = "2026-09-19T18:00:00.000Z";
    inTimezone("Asia/Jakarta"); // 01:00 on the 20th
    expect(isWithinPreset(order, "today", NOW)).toBe(true);
    inTimezone("America/Los_Angeles"); // 11:00 on the 19th; NOW is 13:00 on the 19th there
    expect(isWithinPreset(order, "today", NOW)).toBe(true);
    // …but an order from Jakarta's morning is yesterday to Los Angeles, whose today began later.
    expect(isWithinPreset("2026-09-19T05:00:00.000Z", "today", NOW)).toBe(false);
  });
});

describe("isWithinPreset — the other presets", () => {
  const NOW = new Date(2026, 8, 19, 15, 0, 0); // local time, whatever the zone

  it("'all' never excludes, and neither does 'custom' (its dates live with the caller)", () => {
    expect(isWithinPreset("1999-01-01T00:00:00Z", "all", NOW)).toBe(true);
    expect(isWithinPreset("1999-01-01T00:00:00Z", "custom", NOW)).toBe(true);
  });

  it("'yesterday' is exactly the previous local day", () => {
    const at = (d: number, h: number) => new Date(2026, 8, d, h).toISOString();
    expect(isWithinPreset(at(18, 0), "yesterday", NOW)).toBe(true);
    expect(isWithinPreset(at(18, 23), "yesterday", NOW)).toBe(true);
    expect(isWithinPreset(at(19, 0), "yesterday", NOW)).toBe(false);
    expect(isWithinPreset(at(17, 23), "yesterday", NOW)).toBe(false);
  });

  it("'last7' covers today and the six days before it", () => {
    const at = (d: number) => new Date(2026, 8, d, 12).toISOString();
    expect(isWithinPreset(at(13), "last7", NOW)).toBe(true);
    expect(isWithinPreset(at(12), "last7", NOW)).toBe(false);
  });

  it("drops a timestamp it cannot read from a bounded preset but keeps it in 'all'", () => {
    expect(isWithinPreset("not a date", "today", NOW)).toBe(false);
    expect(isWithinPreset("not a date", "all", NOW)).toBe(true);
  });
});

describe("resolvePresetWindow / resolveDateRangePreset with a supplied 'now'", () => {
  const NOW = new Date(2026, 8, 19, 15, 0, 0);

  it("resolves presets against the supplied day, not the wall clock", () => {
    expect(resolveDateRangePreset("today", NOW)).toEqual({ from: "2026-09-19", to: "2026-09-19" });
    expect(resolveDateRangePreset("yesterday", NOW)).toEqual({
      from: "2026-09-18",
      to: "2026-09-18",
    });
    expect(resolveDateRangePreset("last7", NOW)).toEqual({ from: "2026-09-13", to: "2026-09-19" });
    expect(resolveDateRangePreset("thisMonth", NOW)).toEqual({
      from: "2026-09-01",
      to: "2026-09-19",
    });
    expect(resolveDateRangePreset("lastMonth", NOW)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("has no window for 'all' or 'custom'", () => {
    expect(resolvePresetWindow("all", NOW)).toBeNull();
    expect(resolvePresetWindow("custom", NOW)).toBeNull();
  });

  it("turns 'today' into 00:00 → 23:59:59.999 of the local day", () => {
    const w = resolvePresetWindow("today", NOW)!;
    expect(w.start).toEqual(new Date(2026, 8, 19, 0, 0, 0, 0));
    expect(w.end).toEqual(new Date(2026, 8, 19, 23, 59, 59, 999));
  });
});
