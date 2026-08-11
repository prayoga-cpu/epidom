import { describe, it, expect } from "vitest";
import {
  deriveOnDuty,
  latestEventPerStaff,
  staffClockedInSince,
  type AttendanceEventLike,
} from "../on-duty";

function ev(
  staffMemberId: string,
  type: AttendanceEventLike["type"],
  iso: string
): AttendanceEventLike {
  return { staffMemberId, type, timestamp: new Date(iso) };
}

describe("deriveOnDuty", () => {
  it("treats a staff member whose latest event is a CLOCK_IN as on duty", () => {
    const onDuty = deriveOnDuty([
      ev("a", "CLOCK_IN", "2026-08-11T01:00:00.000Z"),
      ev("a", "CLOCK_OUT", "2026-08-11T05:00:00.000Z"),
      ev("a", "CLOCK_IN", "2026-08-11T06:00:00.000Z"),
    ]);

    expect(onDuty).toHaveLength(1);
    expect(onDuty[0].timestamp.toISOString()).toBe("2026-08-11T06:00:00.000Z");
  });

  it("excludes a staff member whose latest event is a CLOCK_OUT", () => {
    const onDuty = deriveOnDuty([
      ev("a", "CLOCK_IN", "2026-08-11T01:00:00.000Z"),
      ev("a", "CLOCK_OUT", "2026-08-11T09:00:00.000Z"),
    ]);

    expect(onDuty).toEqual([]);
  });

  it("resolves each staff member independently", () => {
    const onDuty = deriveOnDuty([
      ev("a", "CLOCK_IN", "2026-08-11T01:00:00.000Z"),
      ev("b", "CLOCK_IN", "2026-08-11T02:00:00.000Z"),
      ev("b", "CLOCK_OUT", "2026-08-11T08:00:00.000Z"),
      ev("c", "CLOCK_IN", "2026-08-11T03:00:00.000Z"),
    ]);

    expect(onDuty.map((e) => e.staffMemberId).sort()).toEqual(["a", "c"]);
  });

  it("does not depend on input ordering", () => {
    const newestFirst = [
      ev("a", "CLOCK_IN", "2026-08-11T06:00:00.000Z"),
      ev("a", "CLOCK_OUT", "2026-08-11T05:00:00.000Z"),
    ];
    const oldestFirst = [...newestFirst].reverse();

    expect(deriveOnDuty(newestFirst)).toHaveLength(1);
    expect(deriveOnDuty(oldestFirst)).toHaveLength(1);
  });

  it("prefers CLOCK_OUT when both events share the exact same timestamp", () => {
    const sameInstant = "2026-08-11T05:00:00.000Z";

    expect(deriveOnDuty([ev("a", "CLOCK_IN", sameInstant), ev("a", "CLOCK_OUT", sameInstant)])).toEqual(
      []
    );
    expect(deriveOnDuty([ev("a", "CLOCK_OUT", sameInstant), ev("a", "CLOCK_IN", sameInstant)])).toEqual(
      []
    );
  });

  it("treats a reported ABSENCE as the latest event as off duty", () => {
    const onDuty = deriveOnDuty([
      ev("a", "CLOCK_IN", "2026-08-11T01:00:00.000Z"),
      ev("a", "ABSENCE", "2026-08-11T02:00:00.000Z"),
    ]);

    expect(onDuty).toEqual([]);
  });

  it("returns nothing for an empty event list", () => {
    expect(deriveOnDuty([])).toEqual([]);
    expect(latestEventPerStaff([]).size).toBe(0);
  });
});

describe("staffClockedInSince", () => {
  it("collects staff with a CLOCK_IN at or after the cutoff", () => {
    const dayStart = new Date("2026-08-11T00:00:00.000Z");
    const ids = staffClockedInSince(
      [
        ev("a", "CLOCK_IN", "2026-08-10T22:00:00.000Z"), // yesterday
        ev("b", "CLOCK_IN", "2026-08-11T00:00:00.000Z"), // exactly at cutoff
        ev("c", "CLOCK_IN", "2026-08-11T02:00:00.000Z"),
        ev("d", "CLOCK_OUT", "2026-08-11T03:00:00.000Z"), // clock-out only
      ],
      dayStart
    );

    expect([...ids].sort()).toEqual(["b", "c"]);
  });
});
