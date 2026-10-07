/**
 * Pure builders for the Finance "insight" reports — sales patterns, discounts
 * & refunds, tax by rate and estimated labour cost. DB-free like
 * report-aggregation.ts: the routes load rows, these shape them, and the
 * tests in __tests__/insights.test.ts pin the arithmetic.
 *
 * Money conventions match the rest of Finance: every Order/OrderItem amount
 * is literal in the store's own currency, and so is StaffMember.payRate.
 */

import type { OrderType, PayType } from "@prisma/client";
import { refundedTaxPortion } from "@/lib/finance/order-charges";

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

// ─── Labour (estimated) ───

export type LabourBasis = "hours" | "salary" | "commission" | "none";

export interface LabourStaffInput {
  id: string;
  name: string;
  payType: PayType;
  payRate: Money | null;
  isActive: boolean;
}

export interface LabourRow {
  staffMemberId: string;
  name: string;
  payType: PayType;
  payRate: number | null;
  workedMinutes: number;
  workedDays: number;
  basis: LabourBasis;
  /** null when it can't be estimated (no rate, or commission pay). */
  cost: number | null;
}

export interface LabourReport {
  rows: LabourRow[];
  totals: { workedMinutes: number; cost: number; notEstimated: number };
  /** How many months of salary the range is worth (1 for a full month). */
  monthFraction: number;
}

/** How many months a list of "YYYY-MM-DD" days amounts to: each day counts
 * 1 / the number of days in its own month. */
export function monthFractionOf(dateKeys: string[]): number {
  let fraction = 0;
  for (const key of dateKeys) {
    const [year, month] = key.split("-").map(Number);
    fraction += 1 / new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  return fraction;
}

/**
 * An estimate of what the range's work cost, from each person's pay setup:
 * hourly staff by the hours they clocked, salaried staff by their salary
 * prorated to the range. Commission pay is not estimated — orders aren't tied
 * to the person who sold them — and neither is anyone with no rate set. Both
 * are listed so the gap is visible instead of silently costed at zero.
 *
 * Staff appear when active, or when they clocked hours in the range.
 */
export function estimateLabourCost(
  staff: LabourStaffInput[],
  worked: Map<string, { minutes: number; days: number }>,
  dateKeys: string[]
): LabourReport {
  const monthFraction = monthFractionOf(dateKeys);
  const rows: LabourRow[] = [];

  for (const member of staff) {
    const hours = worked.get(member.id) ?? { minutes: 0, days: 0 };
    if (!member.isActive && hours.minutes === 0) continue;
    const rate = member.payRate != null ? Number(member.payRate) : null;

    let basis: LabourBasis = "none";
    let cost: number | null = null;
    if (member.payType === "HOURLY" && rate != null) {
      basis = "hours";
      cost = round2((hours.minutes / 60) * rate);
    } else if (member.payType === "MONTHLY" && rate != null) {
      basis = "salary";
      cost = round2(rate * monthFraction);
    } else if (member.payType === "SALES") {
      basis = "commission";
    }

    rows.push({
      staffMemberId: member.id,
      name: member.name,
      payType: member.payType,
      payRate: rate,
      workedMinutes: hours.minutes,
      workedDays: hours.days,
      basis,
      cost,
    });
  }

  rows.sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.workedMinutes - a.workedMinutes);

  return {
    rows,
    totals: {
      workedMinutes: rows.reduce((sum, r) => sum + r.workedMinutes, 0),
      cost: round2(rows.reduce((sum, r) => sum + (r.cost ?? 0), 0)),
      notEstimated: rows.filter((r) => r.cost == null).length,
    },
    // Rounded for display only — the salaries above use the exact fraction.
    monthFraction: Math.round(monthFraction * 10000) / 10000,
  };
}
