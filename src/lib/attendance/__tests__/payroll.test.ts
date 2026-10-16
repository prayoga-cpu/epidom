import { describe, it, expect } from "vitest";
import { computeStaffPayroll, monthFraction, type PayrollStaffInput } from "../payroll";
import type { HoursReportRow } from "../hours-report";
import { resolveDayOvertime, type OvertimeDecisionInput } from "../overtime-approval";

const STAFF = "staff-1";

/** A day as fetchHoursReport returns it; overtime is paid automatically unless `overtime` says otherwise. */
function day(over: Partial<HoursReportRow> = {}): HoursReportRow {
  const overtimeMinutes = over.overtimeMinutes ?? 0;
  return {
    staffMemberId: STAFF,
    date: "2026-10-01",
    status: "worked",
    pairs: [],
    workedMinutes: 480,
    expectedMinutes: 480,
    expectedSource: "standard",
    expectedWindows: [],
    differenceMinutes: 0,
    regularMinutes: 480,
    overtimeMinutes,
    overtime: resolveDayOvertime(overtimeMinutes, undefined, false),
    openClockIn: null,
    present: true,
    hasLongPair: false,
    ...over,
  };
}

function staff(over: Partial<PayrollStaffInput> = {}): PayrollStaffInput {
  return {
    staffMemberId: STAFF,
    payType: "HOURLY",
    payRate: 20000,
    overtimeRate: null,
    allowances: [],
    attributedSales: null,
    ...over,
  };
}

const OCT = { fromKey: "2026-10-01", toKey: "2026-10-31" };

describe("monthFraction", () => {
  it("is exactly 1 for a whole calendar month", () => {
    expect(monthFraction("2026-10-01", "2026-10-31")).toBe(1);
    expect(monthFraction("2026-02-01", "2026-02-28")).toBe(1);
  });

  it("is days covered over days in the month for part of one", () => {
    expect(monthFraction("2026-10-01", "2026-10-15")).toBeCloseTo(15 / 31);
  });

  it("adds each month's share across a month boundary", () => {
    expect(monthFraction("2026-10-16", "2026-11-15")).toBeCloseTo(16 / 31 + 15 / 30);
  });

  it("is 0 for a reversed range", () => {
    expect(monthFraction("2026-10-10", "2026-10-01")).toBe(0);
  });
});

describe("computeStaffPayroll", () => {
  it("pays an hourly worker regular hours at the rate and overtime at the rate when no overtime rate is set", () => {
    const result = computeStaffPayroll({
      staff: staff(),
      days: [day(), day({ date: "2026-10-02", workedMinutes: 570, regularMinutes: 480, overtimeMinutes: 90, differenceMinutes: 90 })],
      ...OCT,
    });
    expect(result.base).toEqual({ kind: "hourly", rate: 20000, hours: 16, amount: 320000 });
    expect(result.overtime).toEqual({ hours: 1.5, rate: 20000, rateSource: "payRate", amount: 30000 });
    expect(result.total).toBe(350000);
    expect(result.differenceMinutes).toBe(90);
  });

  it("pays overtime at the overtime rate when one is set", () => {
    const result = computeStaffPayroll({
      staff: staff({ overtimeRate: 30000 }),
      days: [day({ workedMinutes: 540, overtimeMinutes: 60, differenceMinutes: 60 })],
      ...OCT,
    });
    expect(result.overtime).toMatchObject({ rate: 30000, rateSource: "overtimeRate", amount: 30000 });
  });

  it("pays a monthly salary in full for a whole month, whatever the attendance", () => {
    const result = computeStaffPayroll({ staff: staff({ payType: "MONTHLY", payRate: 3_100_000 }), days: [], ...OCT });
    expect(result.base).toMatchObject({ kind: "monthly", monthFraction: 1, amount: 3_100_000 });
    expect(result.total).toBe(3_100_000);
  });

  it("pro-rates a monthly salary for part of a month", () => {
    const result = computeStaffPayroll({
      staff: staff({ payType: "MONTHLY", payRate: 3_100_000 }),
      days: [],
      fromKey: "2026-10-01",
      toKey: "2026-10-10",
    });
    expect(result.base.amount).toBe(1_000_000);
  });

  it("tracks a monthly worker's overtime but doesn't pay it without an overtime rate", () => {
    const result = computeStaffPayroll({
      staff: staff({ payType: "MONTHLY", payRate: 3_100_000 }),
      days: [day({ overtimeMinutes: 120 })],
      ...OCT,
    });
    expect(result.overtime).toEqual({ hours: 2, rate: null, rateSource: "none", amount: null });
    expect(result.overtimeMinutes).toBe(120);
    expect(result.total).toBe(3_100_000);
  });

  it("pays commission as a percentage of the attributed sales", () => {
    const result = computeStaffPayroll({
      staff: staff({ payType: "SALES", payRate: 5, attributedSales: 2_000_000 }),
      days: [],
      ...OCT,
    });
    expect(result.base).toEqual({ kind: "sales", percent: 5, sales: 2_000_000, amount: 100_000 });
  });

  it("treats no pay type — or a pay type with no rate — as unknown, never zero", () => {
    expect(computeStaffPayroll({ staff: staff({ payType: "NONE" }), days: [day()], ...OCT }).base).toEqual({
      kind: "notSet",
      amount: null,
    });
    expect(computeStaffPayroll({ staff: staff({ payRate: null }), days: [day()], ...OCT }).base.kind).toBe("notSet");
  });

  it("pays a per-day allowance for every day clocked in, including one still missing its clock-out", () => {
    const result = computeStaffPayroll({
      staff: staff({
        payType: "NONE",
        allowances: [{ id: "a1", name: "Meal", amount: 25000, basis: "PER_DAY" }],
      }),
      days: [
        day(),
        day({ date: "2026-10-02", status: "missingClockOut", workedMinutes: 0, regularMinutes: 0, differenceMinutes: null }),
        day({ date: "2026-10-03", status: "noShow", present: false, workedMinutes: 0, regularMinutes: 0, differenceMinutes: -480 }),
        day({ date: "2026-10-04", status: "absent", present: false, workedMinutes: 0, regularMinutes: 0, differenceMinutes: -480 }),
      ],
      ...OCT,
    });
    expect(result.daysPresent).toBe(2);
    expect(result.absentDays).toBe(2);
    expect(result.incompleteDays).toBe(1);
    expect(result.allowances).toEqual([
      { id: "a1", name: "Meal", basis: "PER_DAY", rate: 25000, quantity: 2, amount: 50000 },
    ]);
    expect(result.total).toBe(50000);
  });

  it("pro-rates a monthly allowance like a monthly salary", () => {
    const result = computeStaffPayroll({
      staff: staff({
        payType: "NONE",
        allowances: [{ id: "a1", name: "Position", amount: 310_000, basis: "PER_MONTH" }],
      }),
      days: [],
      fromKey: "2026-10-01",
      toKey: "2026-10-10",
    });
    expect(result.allowanceTotal).toBe(100_000);
  });

  it("adds base, allowances and overtime into a total that matches its own lines", () => {
    const result = computeStaffPayroll({
      staff: staff({
        payRate: 15333.33,
        overtimeRate: 22000,
        allowances: [{ id: "a1", name: "Transport", amount: 10000.5, basis: "PER_DAY" }],
      }),
      days: [day({ workedMinutes: 500, regularMinutes: 480, overtimeMinutes: 20, differenceMinutes: 20 })],
      ...OCT,
    });
    const lines = (result.base.amount ?? 0) + result.allowanceTotal + (result.overtime.amount ?? 0);
    expect(result.total).toBeCloseTo(lines, 2);
    expect(result.base.amount).toBe(122666.64);
    expect(result.overtime.amount).toBe(7333.33);
  });
});

describe("computeStaffPayroll — implausibly long days", () => {
  it("counts them for the warning but prices the hours as recorded", () => {
    const result = computeStaffPayroll({
      staff: staff(),
      days: [day({ hasLongPair: true, workedMinutes: 1800, regularMinutes: 480, overtimeMinutes: 1320 })],
      ...OCT,
    });
    expect(result.longDays).toBe(1);
    expect(result.overtime.hours).toBe(22);
  });
});

describe("computeStaffPayroll — overtime approval", () => {
  const decided = (decision: OvertimeDecisionInput["decision"], minutes: number): OvertimeDecisionInput => ({
    staffMemberId: STAFF,
    date: "2026-10-01",
    decision,
    minutes,
    approvedMinutes: decision === "APPROVED" ? minutes : 0,
    decidedAt: "2026-10-02T01:00:00.000Z",
    decidedByName: "Owner",
  });
  const overtimeDay = (minutes: number, decision?: OvertimeDecisionInput) =>
    day({
      workedMinutes: 480 + minutes,
      overtimeMinutes: minutes,
      differenceMinutes: minutes,
      overtime: resolveDayOvertime(minutes, decision, true),
    });

  it("pays no overtime that is still waiting for approval, and reports it", () => {
    const result = computeStaffPayroll({ staff: staff(), days: [overtimeDay(90)], ...OCT });
    expect(result.overtime).toMatchObject({ hours: 0, amount: 0 });
    expect(result.overtimeMinutes).toBe(90);
    expect(result.pendingOvertimeMinutes).toBe(90);
    expect(result.paidOvertimeMinutes).toBe(0);
    expect(result.total).toBe(160_000);
  });

  it("pays approved overtime at the overtime rate", () => {
    const result = computeStaffPayroll({
      staff: staff({ overtimeRate: 30000 }),
      days: [overtimeDay(90, decided("APPROVED", 90))],
      ...OCT,
    });
    expect(result.overtime).toMatchObject({ hours: 1.5, amount: 45000 });
    expect(result.paidOvertimeMinutes).toBe(90);
    expect(result.pendingOvertimeMinutes).toBe(0);
    expect(result.total).toBe(205_000);
  });

  it("never pays rejected overtime", () => {
    const result = computeStaffPayroll({ staff: staff(), days: [overtimeDay(90, decided("REJECTED", 90))], ...OCT });
    expect(result.overtime.amount).toBe(0);
    expect(result.rejectedOvertimeMinutes).toBe(90);
    expect(result.total).toBe(160_000);
  });

  it("pays only the minutes approved when the day later grew, and holds the rest", () => {
    // Approved at 60 minutes; a corrected clock-out then made it 90.
    const result = computeStaffPayroll({ staff: staff(), days: [overtimeDay(90, decided("APPROVED", 60))], ...OCT });
    expect(result.paidOvertimeMinutes).toBe(60);
    expect(result.pendingOvertimeMinutes).toBe(30);
    expect(result.overtime.amount).toBe(20000);
  });
});
