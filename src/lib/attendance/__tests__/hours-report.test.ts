import { describe, it, expect } from "vitest";
import { pairAttendanceIntoWorkdays, type AttendanceEventInput } from "../hours-aggregation";
import { buildExpectedDays, type RosterEntryInput } from "../expected-hours";
import { buildHoursReport } from "../hours-report";

const TZ = "Asia/Jakarta"; // UTC+7, no DST
const STAFF = "staff-1";
const STANDARD = 480;

function ev(id: string, type: AttendanceEventInput["type"], iso: string): AttendanceEventInput {
  return { id, staffMemberId: STAFF, type, timestamp: iso };
}

function roster(date: string, over: Partial<RosterEntryInput> = {}): RosterEntryInput {
  return { staffMemberId: STAFF, date, isDayOff: false, startTime: "08:00", endTime: "16:00", ...over };
}

function report(
  events: AttendanceEventInput[],
  rosterRows: RosterEntryInput[] = [],
  opts: { from?: string; to?: string; today?: string; now?: Date } = {}
) {
  const now = opts.now ?? new Date("2026-10-10T05:00:00.000Z");
  return buildHoursReport({
    aggregation: pairAttendanceIntoWorkdays(events, STANDARD, TZ, now),
    expectedDays: buildExpectedDays(rosterRows),
    standardWorkMinutesPerDay: STANDARD,
    fromKey: opts.from ?? "2026-10-01",
    toKey: opts.to ?? "2026-10-10",
    todayKey: opts.today ?? "2026-10-10",
    timeZone: TZ,
  });
}

describe("buildHoursReport — the difference against the expected hours", () => {
  it("shows a day that ran over as a positive difference, all of it overtime", () => {
    const [row] = report([
      ev("1", "CLOCK_IN", "2026-10-05T01:00:00.000Z"), // 08:00 WIB
      ev("2", "CLOCK_OUT", "2026-10-05T10:02:00.000Z"), // 17:02 WIB
    ]);
    expect(row).toMatchObject({
      date: "2026-10-05",
      status: "worked",
      workedMinutes: 542,
      expectedMinutes: 480,
      expectedSource: "standard",
      differenceMinutes: 62,
      regularMinutes: 480,
      overtimeMinutes: 62,
      present: true,
    });
    expect(row.pairs[0]).toMatchObject({ clockInTime: "08:00", clockOutTime: "17:02" });
  });

  it("shows a short day as a negative difference — not a dash", () => {
    const [row] = report([
      ev("1", "CLOCK_IN", "2026-10-05T01:00:00.000Z"),
      ev("2", "CLOCK_OUT", "2026-10-05T06:30:00.000Z"), // 13:30 WIB → 5h 30m
    ]);
    expect(row).toMatchObject({ workedMinutes: 330, differenceMinutes: -150, overtimeMinutes: 0, regularMinutes: 330 });
  });

  it("measures against the rostered block when there is one", () => {
    const [row] = report(
      [ev("1", "CLOCK_IN", "2026-10-05T03:00:00.000Z"), ev("2", "CLOCK_OUT", "2026-10-05T08:00:00.000Z")], // 10:00–15:00
      [roster("2026-10-05", { startTime: "10:00", endTime: "14:00" })]
    );
    expect(row).toMatchObject({ expectedMinutes: 240, expectedSource: "roster", differenceMinutes: 60, overtimeMinutes: 60 });
    expect(row.expectedWindows).toEqual([{ start: "10:00", end: "14:00" }]);
  });

  it("counts every minute worked on a rostered day off as overtime", () => {
    const [row] = report(
      [ev("1", "CLOCK_IN", "2026-10-05T01:00:00.000Z"), ev("2", "CLOCK_OUT", "2026-10-05T05:00:00.000Z")],
      [roster("2026-10-05", { isDayOff: true, startTime: null, endTime: null })]
    );
    expect(row).toMatchObject({ expectedSource: "dayOff", expectedMinutes: 0, differenceMinutes: 240, overtimeMinutes: 240 });
  });
});

describe("buildHoursReport — days the old table dropped", () => {
  it("reports a rostered day nobody clocked in for, once that day has passed", () => {
    const rows = report([], [roster("2026-10-05"), roster("2026-10-10"), roster("2026-10-11")], { to: "2026-10-12" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-10-05",
      status: "noShow",
      workedMinutes: 0,
      differenceMinutes: -480,
      present: false,
    });
  });

  it("marks a reported absence as absent rather than a no-show", () => {
    const rows = report([ev("1", "ABSENCE", "2026-10-05T01:00:00.000Z")], [roster("2026-10-05")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "absent", present: false, differenceMinutes: -480 });
  });

  it("keeps a day whose clock-out is missing, with no difference until it's corrected", () => {
    const rows = report([ev("1", "CLOCK_IN", "2026-10-05T01:00:00.000Z")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "missingClockOut", differenceMinutes: null, present: true });
    expect(rows[0].openClockIn).toMatchObject({ attendanceId: "1", clockInTime: "08:00", isOpen: false });
  });

  it("shows someone clocked in right now as on the clock, not as missing a clock-out", () => {
    const rows = report([ev("1", "CLOCK_IN", "2026-10-10T01:00:00.000Z")], [], {
      now: new Date("2026-10-10T05:00:00.000Z"),
    });
    expect(rows[0]).toMatchObject({ status: "onClock", differenceMinutes: null });
  });

  it("leaves out days outside the range, even when the pad brought their events in", () => {
    const rows = report(
      [ev("1", "CLOCK_IN", "2026-09-30T01:00:00.000Z"), ev("2", "CLOCK_OUT", "2026-09-30T09:00:00.000Z")],
      [roster("2026-09-30")]
    );
    expect(rows).toEqual([]);
  });

  it("keeps a cross-midnight shift on the day it started", () => {
    const [row] = report([
      ev("1", "CLOCK_IN", "2026-10-05T13:00:00.000Z"), // 20:00 WIB Oct 5
      ev("2", "CLOCK_OUT", "2026-10-05T21:00:00.000Z"), // 04:00 WIB Oct 6
    ]);
    expect(row).toMatchObject({ date: "2026-10-05", workedMinutes: 480, differenceMinutes: 0 });
  });
});

describe("buildHoursReport — a clock-out done much later", () => {
  it("flags a stretch longer than 16 hours without trimming it", () => {
    const [row] = report([
      ev("1", "CLOCK_IN", "2026-10-05T01:00:00.000Z"), // 08:00 WIB Oct 5
      ev("2", "CLOCK_OUT", "2026-10-06T02:00:00.000Z"), // 09:00 WIB Oct 6 — 25h later
    ]);
    expect(row).toMatchObject({ hasLongPair: true, workedMinutes: 1500 });
  });

  it("leaves a long but ordinary double shift alone", () => {
    const [row] = report([
      ev("1", "CLOCK_IN", "2026-10-05T01:00:00.000Z"),
      ev("2", "CLOCK_OUT", "2026-10-05T15:00:00.000Z"), // 14h
    ]);
    expect(row.hasLongPair).toBe(false);
  });
});
