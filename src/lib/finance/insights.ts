/**
 * Pure builders for the Finance "insight" reports — sales patterns, discounts
 * & refunds, tax by rate and labour cost (priced by the payroll). DB-free like
 * report-aggregation.ts: the routes load rows, these shape them, and the
 * tests in __tests__/insights.test.ts pin the arithmetic.
 *
 * Money conventions match the rest of Finance: every Order/OrderItem amount
 * is literal in the store's own currency, and so is StaffMember.payRate.
 */

import type { OrderType, PayType } from "@prisma/client";
import { refundedTaxPortion } from "@/lib/finance/order-charges";
import type { StaffPayroll } from "@/lib/attendance/payroll";

type Money = number | string | { toString(): string };

const round2 = (value: number) => Math.round(value * 100) / 100;

// ─── Sales patterns ───

export interface PatternOrderInput {
  orderDate: Date | string;
  total: Money;
  orderType: OrderType;
  guestCount: number | null;
}

export interface OrderTypeRow {
  orderType: OrderType;
  orderCount: number;
  revenue: number;
  /** Guests recorded on these orders (dine-in tables, mostly). */
  guests: number;
}

export interface PatternCell {
  /** 0 = Monday … 6 = Sunday, in the business's own time zone. */
  weekday: number;
  /** 0–23, business-local. */
  hour: number;
  orderCount: number;
  revenue: number;
}

export interface SalesPatterns {
  byOrderType: OrderTypeRow[];
  /** Only the hour/weekday slots that took an order. */
  cells: PatternCell[];
  byHour: { hour: number; orderCount: number; revenue: number }[];
  byWeekday: { weekday: number; orderCount: number; revenue: number }[];
  covers: {
    guests: number;
    /** Orders that recorded a guest count — revenue per guest is taken over
     * these only, so takeaway orders with no count don't dilute it. */
    ordersWithGuests: number;
    revenueWithGuests: number;
  };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** When the business sold: by order type, by hour of day and by weekday. */
export function buildSalesPatterns(orders: PatternOrderInput[], timeZone: string): SalesPatterns {
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  });

  const types = new Map<OrderType, OrderTypeRow>();
  const cells = new Map<string, PatternCell>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orderCount: 0, revenue: 0 }));
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    orderCount: 0,
    revenue: 0,
  }));
  const covers = { guests: 0, ordersWithGuests: 0, revenueWithGuests: 0 };

  for (const order of orders) {
    const total = Number(order.total);

    const type = types.get(order.orderType) ?? {
      orderType: order.orderType,
      orderCount: 0,
      revenue: 0,
      guests: 0,
    };
    type.orderCount += 1;
    type.revenue += total;
    type.guests += order.guestCount ?? 0;
    types.set(order.orderType, type);

    const parts = local.formatToParts(new Date(order.orderDate));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const weekday = Math.max(
      0,
      WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "")
    );
    const key = `${weekday}:${hour}`;
    const cell = cells.get(key) ?? { weekday, hour, orderCount: 0, revenue: 0 };
    cell.orderCount += 1;
    cell.revenue += total;
    cells.set(key, cell);
    byHour[hour].orderCount += 1;
    byHour[hour].revenue += total;
    byWeekday[weekday].orderCount += 1;
    byWeekday[weekday].revenue += total;

    if (order.guestCount && order.guestCount > 0) {
      covers.guests += order.guestCount;
      covers.ordersWithGuests += 1;
      covers.revenueWithGuests += total;
    }
  }

  return {
    byOrderType: Array.from(types.values())
      .map((t) => ({ ...t, revenue: round2(t.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    cells: Array.from(cells.values()).map((c) => ({ ...c, revenue: round2(c.revenue) })),
    byHour: byHour.map((h) => ({ ...h, revenue: round2(h.revenue) })),
    byWeekday: byWeekday.map((d) => ({ ...d, revenue: round2(d.revenue) })),
    covers: { ...covers, revenueWithGuests: round2(covers.revenueWithGuests) },
  };
}

// ─── Discounts, refunds, cancellations, voids ───

export interface ReasonRow {
  /** The cashier's reason as typed, the coupon code, or null for "none given". */
  label: string | null;
  isCoupon: boolean;
  orderCount: number;
  amount: number;
}

export interface AdjustmentsInput {
  discounted: { discountAmount: Money; discountReason: string | null; couponCode: string | null }[];
  refunded: { refundAmount: Money; refundReason: string | null }[];
  cancelled: { orderCount: number; value: number };
  voidedLines: { name: string; quantity: Money; total: Money }[];
}

export interface AdjustmentsReport {
  discounts: ReasonRow[];
  refunds: ReasonRow[];
  cancelled: { orderCount: number; value: number };
  voids: {
    lineCount: number;
    quantity: number;
    value: number;
    topItems: { name: string; lineCount: number; quantity: number; value: number }[];
  };
}

function groupByReason(
  rows: { amount: number; label: string | null; isCoupon: boolean }[]
): ReasonRow[] {
  const groups = new Map<string, ReasonRow>();
  for (const row of rows) {
    // Reasons are free text: "Staff meal" and "staff meal " are one reason.
    const label = row.label?.trim() || null;
    const key = `${row.isCoupon ? "coupon" : "reason"}:${label?.toLowerCase() ?? ""}`;
    const group = groups.get(key) ?? { label, isCoupon: row.isCoupon, orderCount: 0, amount: 0 };
    group.orderCount += 1;
    group.amount += row.amount;
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, amount: round2(g.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Money given away or handed back, and why — the loss-prevention view. */
export function buildAdjustmentsReport(input: AdjustmentsInput): AdjustmentsReport {
  const items = new Map<
    string,
    { name: string; lineCount: number; quantity: number; value: number }
  >();
  let quantity = 0;
  let value = 0;
  for (const line of input.voidedLines) {
    const item = items.get(line.name) ?? { name: line.name, lineCount: 0, quantity: 0, value: 0 };
    item.lineCount += 1;
    item.quantity += Number(line.quantity);
    item.value += Number(line.total);
    items.set(line.name, item);
    quantity += Number(line.quantity);
    value += Number(line.total);
  }

  return {
    discounts: groupByReason(
      input.discounted.map((o) => ({
        amount: Number(o.discountAmount),
        label: o.couponCode ?? o.discountReason,
        isCoupon: o.couponCode != null,
      }))
    ),
    refunds: groupByReason(
      input.refunded.map((o) => ({
        amount: Number(o.refundAmount),
        label: o.refundReason,
        isCoupon: false,
      }))
    ),
    cancelled: { orderCount: input.cancelled.orderCount, value: round2(input.cancelled.value) },
    voids: {
      lineCount: input.voidedLines.length,
      quantity: round2(quantity),
      value: round2(value),
      topItems: Array.from(items.values())
        .map((i) => ({ ...i, quantity: round2(i.quantity), value: round2(i.value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    },
  };
}

// ─── Tax by rate ───

export interface TaxOrderInput {
  taxRate: Money;
  subtotal: Money;
  serviceCharge: Money;
  tax: Money;
  total: Money;
  refundAmount: Money;
}

export interface TaxRateRow {
  /** e.g. 11 for 11% PPN, 10 for French TVA on food; 0 for untaxed sales. */
  ratePct: number;
  orderCount: number;
  /** What the tax was charged on (items after discount + service charge),
   * less the refunded share. */
  taxableBase: number;
  /** Tax charged at sale. */
  taxCharged: number;
  /** The tax share of refunds — handed back, so not owed. */
  refundedTax: number;
  /** taxCharged − refundedTax: what to declare. Adds up to the Tax card. */
  taxOwed: number;
}

/**
 * Tax grouped by the rate frozen on each order, ready for a PPN or TVA return.
 * The base is subtotal + service charge in both pricing modes: in
 * tax-exclusive mode tax is computed on exactly that, and in tax-inclusive
 * mode computeOrderCharges backs both out of the shelf price first.
 */
export function buildTaxRows(orders: TaxOrderInput[]): TaxRateRow[] {
  const rates = new Map<number, Omit<TaxRateRow, "taxOwed">>();
  for (const order of orders) {
    const ratePct = Math.round(Number(order.taxRate) * 10000) / 100;
    const total = Number(order.total);
    const refund = Math.min(Number(order.refundAmount), total);
    const keptShare = total > 0 ? 1 - Math.max(refund, 0) / total : 1;
    const row = rates.get(ratePct) ?? {
      ratePct,
      orderCount: 0,
      taxableBase: 0,
      taxCharged: 0,
      refundedTax: 0,
    };
    row.orderCount += 1;
    row.taxableBase += (Number(order.subtotal) + Number(order.serviceCharge)) * keptShare;
    row.taxCharged += Number(order.tax);
    row.refundedTax += refundedTaxPortion(order);
    rates.set(ratePct, row);
  }
  return Array.from(rates.values())
    .map((r) => ({
      ratePct: r.ratePct,
      orderCount: r.orderCount,
      taxableBase: round2(r.taxableBase),
      taxCharged: round2(r.taxCharged),
      refundedTax: round2(r.refundedTax),
      taxOwed: round2(r.taxCharged - r.refundedTax),
    }))
    .sort((a, b) => b.ratePct - a.ratePct);
}

// ─── Labour ───

/** One staff member's priced pay for the range — what fetchPayroll returns. */
export type LabourPayrollInput = Pick<
  StaffPayroll,
  | "staffMemberId"
  | "payType"
  | "daysPresent"
  | "workedMinutes"
  | "incompleteDays"
  | "base"
  | "allowanceTotal"
  | "overtime"
  | "paidOvertimeMinutes"
  | "pendingOvertimeMinutes"
  | "total"
> & { name: string; payRate: number | null };

export interface LabourRow {
  staffMemberId: string;
  name: string;
  payType: PayType;
  payRate: number | null;
  workedMinutes: number;
  workedDays: number;
  /** Base pay; null when no pay rate is set. */
  base: number | null;
  allowances: number;
  /** Overtime that is paid — approved, or all of it while approval is off. */
  paidOvertimeMinutes: number;
  overtimePay: number | null;
  /** Overtime still waiting for approval: not in `cost`. */
  pendingOvertimeMinutes: number;
  /** base + allowances + overtime pay; null when none of them could be priced. */
  cost: number | null;
}

export interface LabourReport {
  rows: LabourRow[];
  totals: {
    workedMinutes: number;
    base: number;
    allowances: number;
    overtimePay: number;
    paidOvertimeMinutes: number;
    pendingOvertimeMinutes: number;
    cost: number;
    /** Staff with no pay rate set. */
    notEstimated: number;
  };
  /** Days whose clock-out is missing — their hours aren't counted until corrected. */
  incompleteDays: number;
}

/**
 * Labour cost for the range, priced by the same payroll as the Schedule
 * page's Salary tab (src/lib/attendance/payroll.ts) — base pay, allowances
 * and paid overtime — so Finance and Salary always show the same number.
 * Overtime still waiting for approval is reported but not costed. Anyone with
 * no pay rate is listed with what could be priced, and counted, so the gap is
 * visible instead of silently costed at zero.
 */
export function labourFromPayroll(staff: LabourPayrollInput[]): LabourReport {
  const rows: LabourRow[] = staff.map((p) => {
    const overtimePay = p.overtime.amount;
    const priced = p.base.amount !== null || p.allowanceTotal > 0 || (overtimePay ?? 0) > 0;
    return {
      staffMemberId: p.staffMemberId,
      name: p.name,
      payType: p.payType,
      payRate: p.payRate,
      workedMinutes: p.workedMinutes,
      workedDays: p.daysPresent,
      base: p.base.amount,
      allowances: p.allowanceTotal,
      paidOvertimeMinutes: p.paidOvertimeMinutes,
      overtimePay,
      pendingOvertimeMinutes: p.pendingOvertimeMinutes,
      cost: priced ? p.total : null,
    };
  });

  rows.sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.workedMinutes - a.workedMinutes);

  const sum = (pick: (row: LabourRow) => number | null) =>
    round2(rows.reduce((total, row) => total + (pick(row) ?? 0), 0));
  return {
    rows,
    totals: {
      workedMinutes: rows.reduce((total, r) => total + r.workedMinutes, 0),
      base: sum((r) => r.base),
      allowances: sum((r) => r.allowances),
      overtimePay: sum((r) => r.overtimePay),
      paidOvertimeMinutes: rows.reduce((total, r) => total + r.paidOvertimeMinutes, 0),
      pendingOvertimeMinutes: rows.reduce((total, r) => total + r.pendingOvertimeMinutes, 0),
      cost: sum((r) => r.cost),
      notEstimated: rows.filter((r) => r.base === null).length,
    },
    incompleteDays: staff.reduce((total, p) => total + p.incompleteDays, 0),
  };
}
