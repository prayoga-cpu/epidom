/**
 * What each staff member has earned over a period: base pay from their pay
 * type, allowances, and overtime — all driven by attendance (hours-report.ts)
 * and priced at the CURRENT rates on their StaffMember / StaffAllowance rows.
 * Pure and DB-free (the Prisma fetch is fetch-payroll.ts), so the owner's
 * Salary tab and a staff member's My Pay tab run the exact same arithmetic.
 *
 * Money is a literal amount in the store's own currency (never IDR-converted)
 * and is rounded to 2 decimals per line; the total is the sum of the rounded
 * lines, so the breakdown always adds up to what's shown.
 *
 * Deliberately NOT done in v1: deducting a monthly salary for absences or
 * short days (the shortfall is reported, the owner decides), rounding
 * overtime into blocks, or freezing a period once paid — a rate change
 * re-prices past periods too.
 */

import type { HoursReportRow } from "./hours-report";

export type PayType = "HOURLY" | "MONTHLY" | "SALES" | "NONE";
export type AllowanceBasis = "PER_DAY" | "PER_MONTH";

export interface PayrollAllowanceInput {
  id: string;
  name: string;
  amount: number;
  basis: AllowanceBasis;
}

export interface PayrollStaffInput {
  staffMemberId: string;
  payType: PayType;
  payRate: number | null;
  overtimeRate: number | null;
  allowances: PayrollAllowanceInput[];
  /**
   * Sales on till shifts this person opened in the period — the only link
   * from a sale to a staff member that exists (Order has no cashier field).
   * Only read for SALES.
   */
  attributedSales: number | null;
}

export type BasePay =
  | { kind: "hourly"; rate: number; hours: number; amount: number }
  | { kind: "monthly"; rate: number; monthFraction: number; amount: number }
  | { kind: "sales"; percent: number; sales: number; amount: number }
  /** No pay type, or a pay type with no rate: unknown, never zero. */
  | { kind: "notSet"; amount: null };

export interface AllowanceLine {
  id: string;
  name: string;
  basis: AllowanceBasis;
  rate: number;
  /** Days present (PER_DAY) or the period's share of a month (PER_MONTH). */
  quantity: number;
  amount: number;
}

export interface OvertimePay {
  hours: number;
  /** The hourly rate overtime is paid at, or null when none applies. */
  rate: number | null;
  rateSource: "overtimeRate" | "payRate" | "none";
  amount: number | null;
}

export interface StaffPayroll {
  staffMemberId: string;
  payType: PayType;
  daysPresent: number;
  /** Rostered days with no clock-in, and reported absences. */
  absentDays: number;
  /** Days whose clock-out is missing — their open stretch isn't counted until corrected. */
  incompleteDays: number;
  /** Days with an implausibly long clock-in → clock-out stretch (hours-report LONG_PAIR_MINUTES). */
  longDays: number;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  /** Net over (+) / under (−) the expected hours, across days that are complete. */
  differenceMinutes: number;
  base: BasePay;
  allowances: AllowanceLine[];
  allowanceTotal: number;
  overtime: OvertimePay;
  total: number;
  days: HoursReportRow[];
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function dayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * How many months an inclusive "YYYY-MM-DD" range covers, month by month:
 * 1 Oct – 31 Oct is exactly 1, 1–15 Oct is 15/31, 16 Oct – 15 Nov is
 * 16/31 + 15/30. What a monthly salary or allowance is pro-rated by.
 */
export function monthFraction(fromKey: string, toKey: string): number {
  if (toKey < fromKey) return 0;
  let [year, month] = fromKey.split("-").map(Number);
  const [toYear, toMonth] = toKey.split("-").map(Number);
  let total = 0;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthStart = `${year}-${pad(month)}-01`;
    const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;
    const start = fromKey > monthStart ? fromKey : monthStart;
    const end = toKey < monthEnd ? toKey : monthEnd;
    total += (dayNumber(end) - dayNumber(start) + 1) / daysInMonth;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return total;
}

function computeBase(staff: PayrollStaffInput, regularMinutes: number, months: number): BasePay {
  const rate = staff.payRate;
  if (rate === null) return { kind: "notSet", amount: null };

  switch (staff.payType) {
    case "HOURLY": {
      const hours = regularMinutes / 60;
      return { kind: "hourly", rate, hours, amount: roundMoney(hours * rate) };
    }
    case "MONTHLY":
      return { kind: "monthly", rate, monthFraction: months, amount: roundMoney(rate * months) };
    case "SALES": {
      const sales = staff.attributedSales ?? 0;
      return { kind: "sales", percent: rate, sales, amount: roundMoney((sales * rate) / 100) };
    }
    case "NONE":
      return { kind: "notSet", amount: null };
  }
}

function computeOvertime(staff: PayrollStaffInput, overtimeMinutes: number): OvertimePay {
  const hours = overtimeMinutes / 60;
  if (staff.overtimeRate !== null) {
    return {
      hours,
      rate: staff.overtimeRate,
      rateSource: "overtimeRate",
      amount: roundMoney(hours * staff.overtimeRate),
    };
  }
  // An hourly worker's extra hours are still hours: paid at their normal rate.
  if (staff.payType === "HOURLY" && staff.payRate !== null) {
    return { hours, rate: staff.payRate, rateSource: "payRate", amount: roundMoney(hours * staff.payRate) };
  }
  return { hours, rate: null, rateSource: "none", amount: null };
}

export interface ComputeStaffPayrollParams {
  staff: PayrollStaffInput;
  /** This staff member's rows only. */
  days: HoursReportRow[];
  fromKey: string;
  toKey: string;
}

export function computeStaffPayroll({ staff, days, fromKey, toKey }: ComputeStaffPayrollParams): StaffPayroll {
  let workedMinutes = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let differenceMinutes = 0;
  let daysPresent = 0;
  let absentDays = 0;
  let incompleteDays = 0;
  let longDays = 0;

  for (const day of days) {
    workedMinutes += day.workedMinutes;
    regularMinutes += day.regularMinutes;
    overtimeMinutes += day.overtimeMinutes;
    if (day.differenceMinutes !== null) differenceMinutes += day.differenceMinutes;
    if (day.present) daysPresent += 1;
    if (day.status === "absent" || day.status === "noShow") absentDays += 1;
    if (day.status === "missingClockOut") incompleteDays += 1;
    if (day.hasLongPair) longDays += 1;
  }

  const months = monthFraction(fromKey, toKey);
  const base = computeBase(staff, regularMinutes, months);
  const overtime = computeOvertime(staff, overtimeMinutes);

  const allowances: AllowanceLine[] = staff.allowances.map((allowance) => {
    const quantity = allowance.basis === "PER_DAY" ? daysPresent : months;
    return {
      id: allowance.id,
      name: allowance.name,
      basis: allowance.basis,
      rate: allowance.amount,
      quantity,
      amount: roundMoney(allowance.amount * quantity),
    };
  });
  const allowanceTotal = roundMoney(allowances.reduce((sum, line) => sum + line.amount, 0));

  return {
    staffMemberId: staff.staffMemberId,
    payType: staff.payType,
    daysPresent,
    absentDays,
    incompleteDays,
    longDays,
    workedMinutes,
    regularMinutes,
    overtimeMinutes,
    differenceMinutes,
    base,
    allowances,
    allowanceTotal,
    overtime,
    total: roundMoney((base.amount ?? 0) + allowanceTotal + (overtime.amount ?? 0)),
    days,
  };
}
