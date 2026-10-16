import { describe, it, expect } from "vitest";
import {
  applyOvertimeDecisions,
  isOvertimeDecidable,
  nextOvertimeDecision,
  resolveDayOvertime,
  type OvertimeDecisionInput,
} from "../overtime-approval";

const decision = (over: Partial<OvertimeDecisionInput> = {}): OvertimeDecisionInput => ({
  staffMemberId: "s1",
  date: "2026-10-01",
  decision: "APPROVED",
  minutes: 90,
  approvedMinutes: 90,
  decidedAt: "2026-10-02T01:00:00.000Z",
  decidedByName: "Ayu",
  ...over,
});
const rejected = (minutes: number) =>
  decision({ decision: "REJECTED", minutes, approvedMinutes: 0 });

describe("resolveDayOvertime", () => {
  it("pays all overtime automatically while approval is off", () => {
    expect(resolveDayOvertime(90, undefined, false)).toMatchObject({
      status: "automatic",
      paidMinutes: 90,
      pendingMinutes: 0,
    });
  });

  it("ignores a stored decision while approval is off", () => {
    expect(resolveDayOvertime(90, rejected(90), false)).toMatchObject({
      status: "automatic",
      paidMinutes: 90,
    });
  });

  it("has nothing to decide on a day without overtime", () => {
    expect(resolveDayOvertime(0, undefined, true)).toMatchObject({
      status: "none",
      paidMinutes: 0,
      pendingMinutes: 0,
    });
  });

  it("holds undecided overtime as waiting, unpaid", () => {
    expect(resolveDayOvertime(90, undefined, true)).toMatchObject({
      status: "pending",
      paidMinutes: 0,
      pendingMinutes: 90,
      decision: null,
    });
  });

  it("pays approved overtime", () => {
    expect(resolveDayOvertime(90, decision(), true)).toMatchObject({
      status: "approved",
      paidMinutes: 90,
      pendingMinutes: 0,
      rejectedMinutes: 0,
      decision: { decision: "APPROVED", decidedByName: "Ayu" },
    });
  });

  it("pays nothing for rejected overtime", () => {
    expect(resolveDayOvertime(90, rejected(90), true)).toMatchObject({
      status: "rejected",
      paidMinutes: 0,
      rejectedMinutes: 90,
    });
  });

  it("holds minutes added after a decision for a decision of their own", () => {
    // Approved at 60; a clock-out corrected to later made it 90.
    expect(
      resolveDayOvertime(90, decision({ minutes: 60, approvedMinutes: 60 }), true)
    ).toMatchObject({ status: "pending", paidMinutes: 60, pendingMinutes: 30, rejectedMinutes: 0 });
    expect(resolveDayOvertime(90, rejected(60), true)).toMatchObject({
      status: "pending",
      paidMinutes: 0,
      rejectedMinutes: 60,
      pendingMinutes: 30,
    });
  });

  it("is partly approved when some minutes were approved and the rest rejected", () => {
    expect(
      resolveDayOvertime(
        90,
        decision({ decision: "REJECTED", minutes: 90, approvedMinutes: 60 }),
        true
      )
    ).toMatchObject({ status: "partial", paidMinutes: 60, rejectedMinutes: 30, pendingMinutes: 0 });
  });

  it("pays only what is left when the day shrank after an approval", () => {
    expect(resolveDayOvertime(45, decision(), true)).toMatchObject({
      status: "approved",
      paidMinutes: 45,
      pendingMinutes: 0,
    });
  });
});

describe("nextOvertimeDecision", () => {
  it("approves or rejects all of a fresh day", () => {
    const fresh = resolveDayOvertime(90, undefined, true);
    expect(nextOvertimeDecision(90, fresh, "APPROVED")).toEqual({
      minutes: 90,
      approvedMinutes: 90,
    });
    expect(nextOvertimeDecision(90, fresh, "REJECTED")).toEqual({
      minutes: 90,
      approvedMinutes: 0,
    });
  });

  it("rejecting minutes added later keeps the ones approved before", () => {
    const grown = resolveDayOvertime(90, decision({ minutes: 60, approvedMinutes: 60 }), true);
    const next = nextOvertimeDecision(90, grown, "REJECTED");
    expect(next).toEqual({ minutes: 90, approvedMinutes: 60 });
    expect(resolveDayOvertime(90, decision({ decision: "REJECTED", ...next }), true)).toMatchObject(
      { status: "partial", paidMinutes: 60, rejectedMinutes: 30 }
    );
  });

  it("approving minutes added later doesn't approve the ones rejected before", () => {
    const grown = resolveDayOvertime(90, rejected(60), true);
    expect(nextOvertimeDecision(90, grown, "APPROVED")).toEqual({
      minutes: 90,
      approvedMinutes: 30,
    });
  });
});

describe("isOvertimeDecidable", () => {
  it("only a finished day with overtime", () => {
    expect(isOvertimeDecidable({ status: "worked", overtimeMinutes: 30 })).toBe(true);
    expect(isOvertimeDecidable({ status: "worked", overtimeMinutes: 0 })).toBe(false);
    expect(isOvertimeDecidable({ status: "onClock", overtimeMinutes: 30 })).toBe(false);
    expect(isOvertimeDecidable({ status: "missingClockOut", overtimeMinutes: 30 })).toBe(false);
  });
});

describe("applyOvertimeDecisions", () => {
  it("matches each decision to its own staff member and day", () => {
    const rows = applyOvertimeDecisions(
      [
        { staffMemberId: "s1", date: "2026-10-01", overtimeMinutes: 90 },
        { staffMemberId: "s1", date: "2026-10-02", overtimeMinutes: 30 },
        { staffMemberId: "s2", date: "2026-10-01", overtimeMinutes: 60 },
      ],
      [decision()],
      true
    );
    expect(rows.map((r) => r.overtime.status)).toEqual(["approved", "pending", "pending"]);
  });
});
