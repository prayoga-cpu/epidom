import { describe, it, expect } from "vitest";
import { pairAttendanceIntoWorkdays, type AttendanceEventInput } from "../hours-aggregation";

const TZ = "Asia/Jakarta"; // UTC+7, no DST — simplest zone to reason about
const STAFF = "staff-1";
const STANDARD = 480; // 8h

function ev(id: string, type: AttendanceEventInput["type"], iso: string): AttendanceEventInput {
  return { id, staffMemberId: STAFF, type, timestamp: iso };
}

describe("pairAttendanceIntoWorkdays", () => {
  it("pairs a same-day clock-in/out into one completed workday", () => {
    const events = [
      ev("1", "CLOCK_IN", "2026-08-10T01:00:00.000Z"), // 08:00 WIB
      ev("2", "CLOCK_OUT", "2026-08-10T09:00:00.000Z"), // 16:00 WIB
    ];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.dailyRows).toHaveLength(1);
    expect(result.dailyRows[0]).toMatchObject({
      date: "2026-08-10",
      totalMinutes: 480,
      regularMinutes: 480,
      overtimeMinutes: 0,
    });
    expect(result.missingClockOuts).toHaveLength(0);
  });

  it("attributes a cross-midnight shift to the day it started", () => {
    // 20:00 WIB Aug 10 -> 04:00 WIB Aug 11 (13:00Z Aug10 -> 21:00Z Aug10... in UTC+7, 20:00 local = 13:00Z same day, 04:00 local next day = 21:00Z same UTC day)
    const events = [
      ev("1", "CLOCK_IN", "2026-08-10T13:00:00.000Z"), // 20:00 WIB Aug 10
      ev("2", "CLOCK_OUT", "2026-08-10T21:00:00.000Z"), // 04:00 WIB Aug 11
    ];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.dailyRows).toHaveLength(1);
    expect(result.dailyRows[0].date).toBe("2026-08-10");
    expect(result.dailyRows[0].totalMinutes).toBe(480);
  });

  it("flags a stale clock-in as missing when a second clock-in follows without a clock-out", () => {
    const events = [
      ev("1", "CLOCK_IN", "2026-08-10T01:00:00.000Z"),
      ev("2", "CLOCK_IN", "2026-08-10T05:00:00.000Z"),
      ev("3", "CLOCK_OUT", "2026-08-10T09:00:00.000Z"),
    ];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.missingClockOuts).toHaveLength(1);
    expect(result.missingClockOuts[0]).toMatchObject({ attendanceId: "1", isOpen: false });
    // Only the second clock-in through the clock-out is a completed pair.
    expect(result.dailyRows).toHaveLength(1);
    expect(result.dailyRows[0].totalMinutes).toBe(240);
  });

  it("records an orphan clock-out with no matching open clock-in", () => {
    const events = [ev("1", "CLOCK_OUT", "2026-08-10T09:00:00.000Z")];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.orphanClockOuts).toHaveLength(1);
    expect(result.dailyRows).toHaveLength(0);
  });

  it("flags a still-open clock-in at query time as isOpen when it's today", () => {
    const events = [ev("1", "CLOCK_IN", "2026-08-10T01:00:00.000Z")];
    const now = new Date("2026-08-10T05:00:00.000Z");
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ, now);
    expect(result.missingClockOuts).toHaveLength(1);
    expect(result.missingClockOuts[0].isOpen).toBe(true);
  });

  it("flags a still-open clock-in from a prior day as not open", () => {
    const events = [ev("1", "CLOCK_IN", "2026-08-08T01:00:00.000Z")];
    const now = new Date("2026-08-10T05:00:00.000Z");
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ, now);
    expect(result.missingClockOuts[0].isOpen).toBe(false);
  });

  it("keeps an absence day independent, contributing no worked minutes", () => {
    const events = [ev("1", "ABSENCE", "2026-08-10T01:00:00.000Z")];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.absences).toHaveLength(1);
    expect(result.absences[0].date).toBe("2026-08-10");
    expect(result.dailyRows).toHaveLength(0);
  });

  it("sums a split shift (two completed pairs the same day) before applying overtime", () => {
    const events = [
      ev("1", "CLOCK_IN", "2026-08-10T01:00:00.000Z"), // 08:00
      ev("2", "CLOCK_OUT", "2026-08-10T05:00:00.000Z"), // 12:00 (4h)
      ev("3", "CLOCK_IN", "2026-08-10T06:00:00.000Z"), // 13:00
      ev("4", "CLOCK_OUT", "2026-08-10T12:00:00.000Z"), // 19:00 (6h)
    ];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.dailyRows).toHaveLength(1);
    expect(result.dailyRows[0].pairs).toHaveLength(2);
    expect(result.dailyRows[0].totalMinutes).toBe(600); // 10h
    expect(result.dailyRows[0].regularMinutes).toBe(480);
    expect(result.dailyRows[0].overtimeMinutes).toBe(120);
  });

  it("computes overtime exactly at the threshold boundary as zero", () => {
    const events = [
      ev("1", "CLOCK_IN", "2026-08-10T01:00:00.000Z"),
      ev("2", "CLOCK_OUT", "2026-08-10T09:00:00.000Z"), // exactly 480 minutes
    ];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ);
    expect(result.dailyRows[0].overtimeMinutes).toBe(0);
  });

  it("keeps separate staff members' events independent", () => {
    const events: AttendanceEventInput[] = [
      { id: "1", staffMemberId: "a", type: "CLOCK_IN", timestamp: "2026-08-10T01:00:00.000Z" },
      { id: "2", staffMemberId: "a", type: "CLOCK_OUT", timestamp: "2026-08-10T09:00:00.000Z" },
      { id: "3", staffMemberId: "b", type: "CLOCK_IN", timestamp: "2026-08-10T02:00:00.000Z" },
    ];
    const result = pairAttendanceIntoWorkdays(events, STANDARD, TZ, new Date("2026-08-10T10:00:00Z"));
    expect(result.dailyRows.filter((r) => r.staffMemberId === "a")).toHaveLength(1);
    expect(result.missingClockOuts.filter((m) => m.staffMemberId === "b")).toHaveLength(1);
  });
});
