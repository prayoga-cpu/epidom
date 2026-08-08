import { describe, it, expect } from "vitest";
import {
  describeDateRange,
  resolveDateRangePreset,
  DATE_RANGE_PRESETS,
  addDaysLocalISO,
  todayLocalISO,
  startOfMonthLocalISO,
  previousPeriodLocalISO,
} from "../date-range";

describe("describeDateRange", () => {
  const today = todayLocalISO();

  it("recognizes today", () => {
    expect(describeDateRange(today, today)).toBe("today");
  });

  it("recognizes yesterday", () => {
    const yesterday = addDaysLocalISO(today, -1);
    expect(describeDateRange(yesterday, yesterday)).toBe("yesterday");
  });

  it("recognizes last 7 days (inclusive of today)", () => {
    expect(describeDateRange(addDaysLocalISO(today, -6), today)).toBe("last7Days");
  });

  it("recognizes last 30 days (inclusive of today)", () => {
    expect(describeDateRange(addDaysLocalISO(today, -29), today)).toBe("last30Days");
  });

  it("falls back to custom for an arbitrary range", () => {
    expect(describeDateRange("2026-01-01", "2026-01-15")).toBe("custom");
  });

  it("falls back to custom when to is not today, even if the span matches a preset", () => {
    const oneWeekBeforeYesterday = addDaysLocalISO(today, -7);
    const yesterday = addDaysLocalISO(today, -1);
    expect(describeDateRange(oneWeekBeforeYesterday, yesterday)).toBe("custom");
  });
});

describe("resolveDateRangePreset", () => {
  const today = todayLocalISO();

  it("is the exact inverse of describeDateRange for every preset", () => {
    for (const preset of DATE_RANGE_PRESETS) {
      const { from, to } = resolveDateRangePreset(preset);
      expect(describeDateRange(from, to)).toBe(preset);
    }
  });

  it("today resolves to today/today", () => {
    expect(resolveDateRangePreset("today")).toEqual({ from: today, to: today });
  });

  it("thisMonth resolves from the 1st of the current month through today", () => {
    expect(resolveDateRangePreset("thisMonth")).toEqual({
      from: startOfMonthLocalISO(),
      to: today,
    });
  });
});

describe("addDaysLocalISO", () => {
  it("adds and subtracts days without UTC drift", () => {
    expect(addDaysLocalISO("2026-03-01", 1)).toBe("2026-03-02");
    expect(addDaysLocalISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rolls over year boundaries", () => {
    expect(addDaysLocalISO("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("previousPeriodLocalISO", () => {
  it("a single day compares against the single day before it", () => {
    expect(previousPeriodLocalISO("2026-08-08", "2026-08-08")).toEqual({
      from: "2026-08-07",
      to: "2026-08-07",
    });
  });

  it("an 8-day range compares against the equal-length 8-day stretch immediately before it", () => {
    // Aug 1-8 (8 days) -> Jul 24-31 (8 days), not calendar last month.
    expect(previousPeriodLocalISO("2026-08-01", "2026-08-08")).toEqual({
      from: "2026-07-24",
      to: "2026-07-31",
    });
  });

  it("rolls over a month/year boundary", () => {
    expect(previousPeriodLocalISO("2026-01-01", "2026-01-05")).toEqual({
      from: "2025-12-27",
      to: "2025-12-31",
    });
  });
});
