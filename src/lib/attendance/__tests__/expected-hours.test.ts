import { describe, it, expect } from "vitest";
import {
  buildExpectedDays,
  resolveExpectedDay,
  rosterWindowMinutes,
  type RosterEntryInput,
} from "../expected-hours";

const STAFF = "staff-1";
const DAY = "2026-10-05";

function entry(over: Partial<RosterEntryInput> = {}): RosterEntryInput {
  return { staffMemberId: STAFF, date: DAY, isDayOff: false, startTime: "08:00", endTime: "16:00", ...over };
}

describe("rosterWindowMinutes", () => {
  it("measures a same-day block", () => {
    expect(rosterWindowMinutes("08:00", "16:00")).toBe(480);
    expect(rosterWindowMinutes("09:15", "13:45")).toBe(270);
  });

  it("reads an end at or before the start as crossing midnight, like ScheduleShift", () => {
    expect(rosterWindowMinutes("20:00", "04:00")).toBe(480);
    expect(rosterWindowMinutes("08:00", "08:00")).toBe(1440);
  });

  it("returns null for an unreadable time instead of guessing", () => {
    expect(rosterWindowMinutes("8am", "16:00")).toBeNull();
    expect(rosterWindowMinutes("08:00", "25:00")).toBeNull();
  });
});

describe("buildExpectedDays", () => {
  it("expects a rostered block's length, not the store standard", () => {
    const days = buildExpectedDays([entry({ startTime: "10:00", endTime: "14:00" })]);
    expect(resolveExpectedDay(days, STAFF, DAY, 480)).toEqual({
      minutes: 240,
      source: "roster",
      windows: [{ start: "10:00", end: "14:00" }],
    });
  });

  it("adds a split shift's blocks together", () => {
    const days = buildExpectedDays([
      entry({ startTime: "14:00", endTime: "16:00" }),
      entry({ startTime: "08:00", endTime: "10:00" }),
    ]);
    const day = resolveExpectedDay(days, STAFF, DAY, 480);
    expect(day.minutes).toBe(240);
    expect(day.windows.map((w) => w.start)).toEqual(["08:00", "14:00"]);
  });

  it("expects nothing on a day off", () => {
    const days = buildExpectedDays([entry({ isDayOff: true, startTime: null, endTime: null })]);
    expect(resolveExpectedDay(days, STAFF, DAY, 480)).toMatchObject({ minutes: 0, source: "dayOff" });
  });

  it("lets a timed row outrank a day-off row on the same date", () => {
    const days = buildExpectedDays([
      entry({ isDayOff: true, startTime: null, endTime: null }),
      entry({ startTime: "08:00", endTime: "12:00" }),
    ]);
    expect(resolveExpectedDay(days, STAFF, DAY, 480)).toMatchObject({ minutes: 240, source: "roster" });
  });

  it("falls back to the store standard with no usable roster row", () => {
    const days = buildExpectedDays([entry({ startTime: null, endTime: null })]);
    expect(resolveExpectedDay(days, STAFF, DAY, 450)).toEqual({ minutes: 450, source: "standard", windows: [] });
    expect(resolveExpectedDay(days, "someone-else", DAY, 450).source).toBe("standard");
  });
});
