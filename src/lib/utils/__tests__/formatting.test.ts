import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  getCurrencySymbol,
  roundToSixDecimals,
  formatDerivedUnitCost,
  formatLongElapsed,
  formatDayDate,
  formatDateTimeWithTimezone,
} from "../formatting";

describe("getCurrencySymbol", () => {
  it.each([
    ["IDR", "Rp"],
    ["USD", "$"],
    ["EUR", "€"],
    ["GBP", "£"],
  ])("returns the correct symbol for %s", (code, expected) => {
    expect(getCurrencySymbol(code)).toBe(expected);
  });

  it("returns a non-empty symbol for newly-added Southeast Asian currencies", () => {
    for (const code of ["THB", "MYR", "SGD", "KHR"]) {
      expect(getCurrencySymbol(code).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the raw code for an invalid currency", () => {
    expect(getCurrencySymbol("NOTREAL")).toBe("NOTREAL");
  });
});

describe("formatCurrency", () => {
  it("uses 0 decimal places for IDR (regional override)", () => {
    expect(formatCurrency(50000, "IDR", "id-ID")).not.toMatch(/,00$/);
  });

  it("uses 2 decimal places for USD/EUR (ISO default)", () => {
    expect(formatCurrency(10, "USD", "en-US")).toBe("$10.00");
    expect(formatCurrency(10, "EUR", "en-US")).toContain(".00");
  });

  it("uses 0 decimal places for JPY without needing an explicit override", () => {
    const result = formatCurrency(1000, "JPY", "en-US");
    expect(result).not.toMatch(/\.00/);
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatCurrency(null)).toBe("");
    expect(formatCurrency(undefined)).toBe("");
  });
});

describe("roundToSixDecimals", () => {
  it("rounds a clean pack-price division to exactly 6 decimals", () => {
    // e.g. a €2, 1000g pack of flour derives to €0.002/g
    expect(roundToSixDecimals(2 / 1000)).toBe(0.002);
  });

  it("collapses the classic floating-point 0.1 + 0.2 trap", () => {
    expect(roundToSixDecimals(0.1 + 0.2)).toBe(0.3);
  });

  it("rounds a repeating decimal to 6 places instead of truncating", () => {
    expect(roundToSixDecimals(1 / 3)).toBe(0.333333);
  });
});

describe("formatDerivedUnitCost", () => {
  it("shows up to 4 decimals for sub-1 values, trimming trailing zeros", () => {
    expect(formatDerivedUnitCost(0.002)).toBe("0.002");
    expect(formatDerivedUnitCost(0.1)).toBe("0.1");
  });

  it("shows up to 2 decimals for values >= 1, trimming trailing zeros", () => {
    expect(formatDerivedUnitCost(2.5)).toBe("2.5");
    expect(formatDerivedUnitCost(2)).toBe("2");
  });
});

/**
 * The KDS ticket timer switches from a live mm:ss counter to this format
 * once a ticket has been open for an hour — a stale/abandoned in-progress
 * order should read "8hrs 9mins ago", not an absurd "51482m 50s".
 */
describe("formatLongElapsed", () => {
  it("formats under a day as '<hours>hrs <minutes>mins ago'", () => {
    expect(formatLongElapsed(8 * 3600 + 9 * 60)).toBe("8hrs 9mins ago");
  });

  it("omits the minutes part on an exact hour", () => {
    expect(formatLongElapsed(3 * 3600)).toBe("3hrs ago");
  });

  it("formats a full day or more (but under 30 days) as '<n> days ago'", () => {
    expect(formatLongElapsed(7 * 86400)).toBe("7 days ago");
    expect(formatLongElapsed(1 * 86400)).toBe("1 day ago");
  });

  it("formats 30+ days as '<n> month(s) <n> days ago'", () => {
    expect(formatLongElapsed(34 * 86400)).toBe("1 month 4 days ago");
  });

  it("omits the days part on an exact month boundary", () => {
    expect(formatLongElapsed(60 * 86400)).toBe("2 months ago");
  });
});

describe("formatDayDate", () => {
  it("formats as '<weekday>, <day> <month>' with no year", () => {
    // A fixed Thursday so the weekday assertion isn't calendar-dependent.
    expect(formatDayDate("2026-07-09", "en")).toBe("Thursday, 9 July");
  });

  it("never includes a 4-digit year", () => {
    expect(formatDayDate("2026-07-09", "en")).not.toMatch(/\d{4}/);
  });
});

describe("formatDateTimeWithTimezone", () => {
  it("includes the weekday, exact date, year, and a timezone offset", () => {
    const result = formatDateTimeWithTimezone("2026-07-09", "en");
    expect(result).toContain("Thursday");
    expect(result).toContain("2026");
    // Intl's short timeZoneName is either an abbreviation (e.g. "PST") or a
    // GMT offset (e.g. "GMT+7") depending on the runtime's ICU data — assert
    // only that *something* beyond the plain date/time got appended.
    expect(result.length).toBeGreaterThan("Thursday, Jul 9, 2026, 12:00 AM".length);
  });

  it("appends the full zone name in parentheses when it differs from the offset", () => {
    // Asia/Jakarta's offset ("GMT+7") and long zone name ("Western
    // Indonesia Time") are always distinct, unlike some zones where Intl's
    // short/long forms happen to coincide — a stable case to assert the
    // "OFFSET (Zone Name)" combined shape actually appears.
    const original = process.env.TZ;
    process.env.TZ = "Asia/Jakarta";
    try {
      const result = formatDateTimeWithTimezone("2026-07-09", "en");
      expect(result).toContain("GMT+7 (Western Indonesia Time)");
    } finally {
      process.env.TZ = original;
    }
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatDateTimeWithTimezone(null)).toBe("");
    expect(formatDateTimeWithTimezone(undefined)).toBe("");
  });
});
