/**
 * Partner commission arithmetic, pure (no Stripe, no Prisma).
 *
 * A partner earns `rate`% of what a customer they brought pays during a window
 * of N calendar months that starts with the customer's first paid invoice
 * (a free trial's $0 invoice doesn't start it). Each invoice counts in
 * proportion to how much of the time it pays for falls inside the window:
 *
 * - monthly plan, 3-month window: invoices 1, 2 and 3 count in full, the 4th
 *   counts nothing;
 * - yearly plan: the yearly invoice pays for 12 months, 3 of them in the
 *   window, so 3/12 of it counts: the same value as three monthly invoices;
 * - an upgrade's prorated invoice counts for the part of its period that is
 *   inside the window.
 *
 * Everything is in the currency's smallest unit (Stripe's integers), and every
 * result is rounded down to a whole unit.
 */

/** One invoice line, as Stripe gives it (amounts in minor units, period in seconds). */
export interface CommissionLine {
  /** Line amount before discounts, without exclusive tax. Negative for a credit. */
  amount: number;
  /** Sum of the line's discount_amounts. */
  discountAmount: number;
  /** Tax included in `amount` (tax_behavior "inclusive"). */
  inclusiveTax: number;
  periodStart: number;
  periodEnd: number;
}

export interface CommissionInvoice {
  lines: CommissionLine[];
  /** What the customer paid on this invoice. */
  amountPaid: number;
  /** The invoice total (after discounts). */
  total: number;
}

export interface CommissionWindow {
  /** Seconds. */
  start: number;
  /** Seconds. */
  end: number;
}

/** `date` plus `months` calendar months (UTC), the day clamped to the month's last day. */
export function addCalendarMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const target = new Date(
    Date.UTC(
      y,
      m,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

/**
 * How many calendar months lie between two instants (seconds), with the last,
 * partial month as a fraction of its own length. 0 when `end` ≤ `start`.
 */
export function calendarMonthsBetween(start: number, end: number): number {
  if (end <= start) return 0;
  const from = new Date(start * 1000);
  let whole = 0;
  let cursor = start;
  // Each step is counted from `from`, not chained, so Jan 31 → Feb 28 → Mar 31.
  for (;;) {
    const next = Math.floor(addCalendarMonths(from, whole + 1).getTime() / 1000);
    if (next > end) return whole + (end - cursor) / (next - cursor);
    whole += 1;
    cursor = next;
    if (next === end) return whole;
  }
}

/** The commission window that a first paid invoice starting at `start` opens. */
export function commissionWindow(start: number, months: number): CommissionWindow {
  return {
    start,
    end: Math.floor(addCalendarMonths(new Date(start * 1000), months).getTime() / 1000),
  };
}

/** The share (0–1) of a line's period that falls inside the window, in calendar months. */
export function lineShareInWindow(line: CommissionLine, window: CommissionWindow): number {
  const length = calendarMonthsBetween(line.periodStart, line.periodEnd);
  if (length <= 0) {
    // A line with no length (a one-off charge) counts when it falls inside the window.
    return line.periodStart >= window.start && line.periodStart < window.end ? 1 : 0;
  }
  const overlap = calendarMonthsBetween(
    Math.max(line.periodStart, window.start),
    Math.min(line.periodEnd, window.end)
  );
  return Math.min(1, Math.max(0, overlap / length));
}

/** The part of an invoice that earns commission, in minor units. */
export function commissionableAmount(invoice: CommissionInvoice, window: CommissionWindow): number {
  if (invoice.amountPaid <= 0 || invoice.total <= 0) return 0;
  let weighted = 0;
  for (const line of invoice.lines) {
    const net = line.amount - line.discountAmount - line.inclusiveTax;
    weighted += net * lineShareInWindow(line, window);
  }
  // Part of the invoice can be paid from the customer's balance, not by them.
  const paidShare = Math.min(1, invoice.amountPaid / invoice.total);
  return Math.max(0, Math.floor(weighted * paidShare));
}

/** `ratePercent`% of an amount in minor units, rounded down. */
export function commissionOf(amount: number, ratePercent: number): number {
  if (amount <= 0 || ratePercent <= 0) return 0;
  return Math.floor((amount * ratePercent) / 100);
}

/** The share of a payment a refund takes back, applied to the commission it earned (minor units, ≤ 0). */
export function refundAdjustment(
  commission: number,
  paymentAmount: number,
  refundAmount: number
): number {
  if (commission <= 0 || paymentAmount <= 0 || refundAmount <= 0) return 0;
  const share = Math.min(1, refundAmount / paymentAmount);
  return -Math.min(commission, Math.ceil(commission * share));
}
