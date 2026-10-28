import { describe, it, expect } from "vitest";
import { utcToZonedWallTime, zonedWallTimeToUtc } from "../zoned-time";

describe("zonedWallTimeToUtc", () => {
  it("reads a Paris winter time at UTC+1", () => {
    expect(zonedWallTimeToUtc("2026-11-03", "10:00", "Europe/Paris").toISOString()).toBe(
      "2026-11-03T09:00:00.000Z"
    );
  });

  it("reads a Paris summer time at UTC+2", () => {
    expect(zonedWallTimeToUtc("2026-07-14", "10:00", "Europe/Paris").toISOString()).toBe(
      "2026-07-14T08:00:00.000Z"
    );
  });

  it("reads Jakarta at UTC+7 (no DST)", () => {
    expect(zonedWallTimeToUtc("2026-11-03", "09:30", "Asia/Jakarta").toISOString()).toBe(
      "2026-11-03T02:30:00.000Z"
    );
  });

  // 2026-03-29: Paris jumps 02:00 → 03:00.
  it("keeps the times either side of the spring-forward exact", () => {
    expect(zonedWallTimeToUtc("2026-03-29", "01:30", "Europe/Paris").toISOString()).toBe(
      "2026-03-29T00:30:00.000Z"
    );
    expect(zonedWallTimeToUtc("2026-03-29", "03:30", "Europe/Paris").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    );
  });

  it("moves a time the spring-forward skips an hour later", () => {
    expect(zonedWallTimeToUtc("2026-03-29", "02:30", "Europe/Paris").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    );
  });

  // 2026-10-25: Paris falls back 03:00 → 02:00.
  it("keeps the times either side of the fall-back exact", () => {
    expect(zonedWallTimeToUtc("2026-10-25", "01:30", "Europe/Paris").toISOString()).toBe(
      "2026-10-24T23:30:00.000Z"
    );
    expect(zonedWallTimeToUtc("2026-10-25", "10:00", "Europe/Paris").toISOString()).toBe(
      "2026-10-25T09:00:00.000Z"
    );
  });

  it("round-trips through utcToZonedWallTime", () => {
    for (const zone of ["Europe/Paris", "Asia/Jakarta", "America/New_York", "UTC"]) {
      const instant = zonedWallTimeToUtc("2026-12-01", "18:45", zone);
      expect(utcToZonedWallTime(instant, zone)).toEqual({ date: "2026-12-01", time: "18:45" });
    }
  });
});

describe("utcToZonedWallTime", () => {
  it("shows midnight as 00:00, not 24:00", () => {
    expect(utcToZonedWallTime("2026-11-02T23:00:00.000Z", "Europe/Paris")).toEqual({
      date: "2026-11-03",
      time: "00:00",
    });
  });
});
