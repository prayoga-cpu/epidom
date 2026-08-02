import { describe, it, expect } from "vitest";
import { describeDateRange, addDaysLocalISO, todayLocalISO } from "../date-range";

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

describe("addDaysLocalISO", () => {
  it("adds and subtracts days without UTC drift", () => {
    expect(addDaysLocalISO("2026-03-01", 1)).toBe("2026-03-02");
    expect(addDaysLocalISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rolls over year boundaries", () => {
    expect(addDaysLocalISO("2025-12-31", 1)).toBe("2026-01-01");
  });
});
