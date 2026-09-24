import { describe, it, expect } from "vitest";
import { expectedCalendarDay, getDeliveryTiming, tomorrowDateInput } from "../delivery-timing";

// Local noon, so "today" is unambiguous whatever timezone the suite runs in.
const NOW = new Date(2026, 8, 24, 12, 0, 0); // 24 Sep 2026

/** How the create dialogs' `<input type="date">` value comes back from the API. */
const fromDateInput = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`).toISOString();

/** How the old calendar-picker edit stored a day: that day's LOCAL midnight. */
const localMidnight = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();

describe("getDeliveryTiming — the status an open order shows by itself", () => {
  it("expected in the future: on the way, with the days left", () => {
    expect(getDeliveryTiming(fromDateInput("2026-09-25"), NOW)).toEqual({
      kind: "upcoming",
      days: 1,
    });
    expect(getDeliveryTiming(fromDateInput("2026-09-28"), NOW)).toEqual({
      kind: "upcoming",
      days: 4,
    });
  });

  it("expected today: due today", () => {
    expect(getDeliveryTiming(fromDateInput("2026-09-24"), NOW)).toEqual({ kind: "dueToday" });
  });

  it("expected day has passed without Received: late, by how many days", () => {
    expect(getDeliveryTiming(fromDateInput("2026-09-23"), NOW)).toEqual({ kind: "late", days: 1 });
    expect(getDeliveryTiming(fromDateInput("2026-09-14"), NOW)).toEqual({
      kind: "late",
      days: 10,
    });
  });

  it("turns late at midnight, not 24 hours after the expected day started", () => {
    const lateEvening = new Date(2026, 8, 24, 23, 59);
    const justAfterMidnight = new Date(2026, 8, 25, 0, 1);
    expect(getDeliveryTiming(fromDateInput("2026-09-24"), lateEvening).kind).toBe("dueToday");
    expect(getDeliveryTiming(fromDateInput("2026-09-24"), justAfterMidnight)).toEqual({
      kind: "late",
      days: 1,
    });
  });

  it("no expected date: plain 'ordered', never late", () => {
    expect(getDeliveryTiming(null, NOW)).toEqual({ kind: "noDate" });
    expect(getDeliveryTiming(undefined, NOW)).toEqual({ kind: "noDate" });
    expect(getDeliveryTiming("not a date", NOW)).toEqual({ kind: "noDate" });
  });
});

describe("expectedCalendarDay — both stored shapes name the same day", () => {
  it("a date-input value (UTC midnight) reads as that calendar day in any timezone", () => {
    const day = expectedCalendarDay(fromDateInput("2026-09-25"));
    expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 9, 25]);
  });

  it("a calendar pick stored as local midnight reads as that calendar day", () => {
    const day = expectedCalendarDay(localMidnight(2026, 9, 25));
    expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 9, 25]);
  });

  it("a bare YYYY-MM-DD (an optimistic cache write) reads as that day", () => {
    const day = expectedCalendarDay("2026-09-25");
    expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 9, 25]);
  });
});

describe("tomorrowDateInput — the default expected delivery date", () => {
  it("is the next local day as YYYY-MM-DD", () => {
    expect(tomorrowDateInput(NOW)).toBe("2026-09-25");
  });

  it("rolls over month and year ends", () => {
    expect(tomorrowDateInput(new Date(2026, 8, 30, 9))).toBe("2026-10-01");
    expect(tomorrowDateInput(new Date(2026, 11, 31, 9))).toBe("2027-01-01");
  });
});
