/**
 * Pure figures behind the Finish Shift screen and its confirmation — plain data
 * in, plain data out, so the arithmetic that decides "is the drawer short" is
 * unit-testable without rendering anything.
 *
 * Everything is derived from the server's ShiftReportData, the same object the
 * printed and browser reports are built from, so this screen cannot show a
 * different expected-cash figure than the paper.
 *
 * Two scopes meet here, on purpose, exactly as they do on the printed report
 * (see project_shift_window_semantics):
 *  - the CASH section is by `Order.shiftId` linkage — the cash this till is
 *    personally accountable for;
 *  - the OTHER PAYMENTS section is by the till's time window — every sale taken
 *    while it was open, storefront and aggregator orders included.
 * Cash sales the window saw but no till was linked to stay out of the expected
 * total and are surfaced separately (`unlinkedCashSales`).
 */

import { CASH_PAYMENT_METHOD } from "@/lib/finance/cash-drawer";
import type { ShiftReportCashDrawer, ShiftReportData } from "@/lib/finance/shift-report";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type CashDetailKey =
  | "openingCash"
  | "cashSales"
  | "cashRefunds"
  | "tips"
  | "floatTopUp"
  | "paidOut"
  | "safeDrop"
  | "tipsPaidOut";

export interface CashDetailRow {
  key: CashDetailKey;
  /** A positive magnitude — `direction` says whether it adds to or leaves the drawer. */
  amount: number;
  direction: "in" | "out";
}

/**
 * Every way cash reached or left the drawer, in the order the drawer's expected
 * total is built. The opening float and cash sales always show — a cash-free
 * shift reading "0" is information — while a category nothing happened in is
 * skipped, the same rule the printed report follows.
 */
export function buildCashDetailRows(drawer: ShiftReportCashDrawer): CashDetailRow[] {
  const rows: CashDetailRow[] = [
    { key: "openingCash", amount: drawer.openingCash, direction: "in" },
    { key: "cashSales", amount: drawer.cashSales, direction: "in" },
  ];
  const optional: CashDetailRow[] = [
    { key: "cashRefunds", amount: drawer.cashRefunds, direction: "out" },
    { key: "tips", amount: drawer.tips, direction: "in" },
    { key: "floatTopUp", amount: drawer.pettyIn, direction: "in" },
    { key: "paidOut", amount: drawer.pettyOut, direction: "out" },
    { key: "safeDrop", amount: drawer.drops, direction: "out" },
    { key: "tipsPaidOut", amount: drawer.tipPayouts, direction: "out" },
  ];
  return [...rows, ...optional.filter((row) => row.amount > 0)];
}

export interface OtherPaymentRow {
  paymentMethod: string;
  orderCount: number;
  revenue: number;
}

/** Non-cash tenders — the right-hand "other payments" column. Cash lives in the drawer section. */
export function buildOtherPayments(report: ShiftReportData): {
  rows: OtherPaymentRow[];
  total: number;
} {
  const rows = report.byPaymentMethod
    .filter((method) => method.paymentMethod !== CASH_PAYMENT_METHOD)
    .map(({ paymentMethod, orderCount, revenue }) => ({ paymentMethod, orderCount, revenue }));
  return { rows, total: round2(rows.reduce((acc, row) => acc + row.revenue, 0)) };
}

/**
 * counted − expected. Null until a count has been typed: an empty field is "not
 * counted yet", never "counted zero" — treating it as zero would print a
 * shortage the size of the whole drawer the moment the screen opens.
 */
export function cashDifference(counted: number | undefined, expected: number): number | null {
  if (counted === undefined || Number.isNaN(counted)) return null;
  return round2(counted - expected);
}

export type DifferenceTone = "pending" | "balanced" | "over" | "short";

export function differenceTone(difference: number | null): DifferenceTone {
  if (difference === null) return "pending";
  if (difference === 0) return "balanced";
  return difference > 0 ? "over" : "short";
}
