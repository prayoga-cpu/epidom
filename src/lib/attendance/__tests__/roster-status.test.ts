import { describe, it, expect } from "vitest";
import { selectLateRoster } from "../roster-status";

const TZ = "Asia/Jakarta"; // UTC+7, no DST — simplest zone to reason about
const DATE = "2026-08-11";

interface Row {
  staffMemberId: string;
  startTime: string | null;
}

function run(rows: Row[], nowIso: string, attended: string[] = [], graceMinutes = 5) {
  return selectLateRoster(rows, {
    startTimeOf: (row) => row.startTime,
    attended: new Set(attended),
    now: new Date(nowIso),
    businessDate: DATE,
    timeZone: TZ,
    graceMinutes,
  });
}

describe("selectLateRoster", () => {
  it("flags a rostered staff member whose start passed with no clock-in", () => {
    // 09:00 WIB = 02:00Z; "now" is 02:30Z → 30 minutes late.
    const late = run([{ staffMemberId: "a", startTime: "09:00" }], "2026-08-11T02:30:00.000Z");

    expect(late).toHaveLength(1);
    expect(late[0].row.staffMemberId).toBe("a");
    expect(late[0].startTime).toBe("09:00");
    expect(late[0].minutesLate).toBe(30);
  });

  it("does not flag someone still inside the grace window", () => {
    // 4 minutes past a 5-minute grace threshold.
    expect(run([{ staffMemberId: "a", startTime: "09:00" }], "2026-08-11T02:04:00.000Z")).toEqual(
      []
    );
  });

  it("does not flag a shift that has not started yet", () => {
    expect(run([{ staffMemberId: "a", startTime: "17:00" }], "2026-08-11T02:00:00.000Z")).toEqual(
      []
    );
  });

  it("does not flag someone who already clocked in", () => {
    expect(
      run([{ staffMemberId: "a", startTime: "09:00" }], "2026-08-11T04:00:00.000Z", ["a"])
    ).toEqual([]);
  });

  it("skips roster rows with no resolvable start time", () => {
    expect(run([{ staffMemberId: "a", startTime: null }], "2026-08-11T12:00:00.000Z")).toEqual([]);
  });

  it("sorts the latest arrival first", () => {
    const late = run(
      [
        { staffMemberId: "a", startTime: "09:00" }, // 2h late
        { staffMemberId: "b", startTime: "06:00" }, // 5h late
        { staffMemberId: "c", startTime: "10:00" }, // 1h late
      ],
      "2026-08-11T04:00:00.000Z"
    );

    expect(late.map((entry) => entry.row.staffMemberId)).toEqual(["b", "a", "c"]);
    expect(late.map((entry) => entry.minutesLate)).toEqual([300, 120, 60]);
  });

  it("measures the start against the store's timezone, not the runtime's", () => {
    // 09:00 in Jakarta (UTC+7) is 02:00Z. At 01:30Z nobody is late yet, even
    // though 09:00 has already passed in a UTC-reasoning runtime.
    expect(run([{ staffMemberId: "a", startTime: "09:00" }], "2026-08-11T01:30:00.000Z")).toEqual(
      []
    );
  });

  it("returns nothing for an empty roster", () => {
    expect(run([], "2026-08-11T12:00:00.000Z")).toEqual([]);
  });
});
