/**
 * Cash on hand — what should physically be in the register.
 *
 * Orders only account for cash that arrives by selling something. The drawer
 * also gains tips and float top-ups, and loses paid-outs, safe drops, refunds
 * and tip payouts. Summing "opening float + cash sales" — which is all the
 * shift-close route used to do — answers a question nobody asked.
 *
 * Pure (plain data in, plain data out) so the arithmetic is unit-testable
 * without mocking Prisma, matching report-aggregation.ts and shift-report.ts.
 * The Prisma fetch lives in services/cash-drawer.service.ts.
 *
 * ONE computation feeds every surface — the shift-close PATCH, the live
 * shift/daily report (browser, ESC/POS and JSON), the Finance cash tab and the
 * dashboard operations card — so no two screens can disagree about how much
 * money is supposed to be in the till.
 */

import type { CashMovementType } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";

/** Money as it arrives from either a test fixture (number) or Prisma
 * (`Decimal`, which stringifies losslessly). Same widening as DecimalLike in
 * shift-report.ts — redeclared rather than imported so this module stays
 * independent of the report aggregator. */
export type DecimalLike = number | string | { toString(): string };

/** The only payment method whose money lands in a physical drawer. */
export const CASH_PAYMENT_METHOD = "CASH";

/**
 * Which way each movement type pushes the drawer balance.
 *
 * `CashMovement.amount` is always stored positive; this map is the only place
 * direction is decided. Keeping the sign out of the column means "how much was
 * tipped today" is a plain SUM, and a UI bug cannot write a negative TIP that
 * silently inflates the expected balance.
 */
export const CASH_MOVEMENT_DIRECTION: Record<CashMovementType, 1 | -1> = {
  TIP: 1,
  PETTY_IN: 1,
  PETTY_OUT: -1,
  DROP: -1,
  PAYOUT: -1,
};

/** Movement types that add to the drawer. Exported for UI grouping/labels. */
export const INBOUND_CASH_MOVEMENT_TYPES = (
  Object.keys(CASH_MOVEMENT_DIRECTION) as CashMovementType[]
).filter((type) => CASH_MOVEMENT_DIRECTION[type] === 1);

/** Movement types that remove cash. These are the ones the API demands a
 * `reason` for — "where did the money go" is the entire point of the row. */
export const OUTBOUND_CASH_MOVEMENT_TYPES = (
  Object.keys(CASH_MOVEMENT_DIRECTION) as CashMovementType[]
).filter((type) => CASH_MOVEMENT_DIRECTION[type] === -1);

export interface CashOnHandOrderInput {
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  total: DecimalLike;
  refundAmount: DecimalLike;
}

export interface CashMovementInput {
  type: CashMovementType;
  amount: DecimalLike;
}

export interface CashOnHandBreakdown {
  openingCash: number;
  /** Cash taken over the counter for orders rung up in the window. */
  cashSales: number;
  /** Cash handed back in the window. Reported positive; subtracted below. */
  cashRefunds: number;
  tips: number;
  pettyIn: number;
  /** Reported positive; subtracted below. */
  pettyOut: number;
  /** Reported positive; subtracted below. */
  drops: number;
  /** Reported positive; subtracted below. */
  tipPayouts: number;
  /**
   * Cash sales in the window that could NOT be attributed to a till, i.e.
   * `Order.shiftId` is null. Informational only — deliberately NOT part of
   * `expectedCash`.
   *
   * Nothing in the schema records whether a given order's cash reached a
   * register. An unlinked CASH order is either a storefront order paid at the
   * counter (the money IS in the drawer) or a delivery/aggregator order
   * settled with a courier or the platform (it is not). Folding it into the
   * expectation would invent a shortage the size of the delivery cash;
   * dropping it silently would hide counter cash. So it is surfaced as its own
   * line for a human to reconcile, and left out of the arithmetic.
   */
  unlinkedCashSales: number;
  /** openingCash + cashSales - cashRefunds + tips + pettyIn - pettyOut - drops - tipPayouts */
  expectedCash: number;
  /** What was actually counted. Null while the till is still open. */
  closingCash: number | null;
  /** closingCash - expectedCash. Null until a count exists. Positive = over. */
  cashDifference: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: DecimalLike[]) => values.reduce<number>((a, v) => a + Number(v), 0);

/** A movement's contribution to the drawer, sign applied. */
export function signedCashAmount(movement: CashMovementInput): number {
  return Number(movement.amount) * CASH_MOVEMENT_DIRECTION[movement.type];
}

/**
 * Did this order's cash actually reach the drawer?
 *
 * PENDING is the one that used to poison the figure: a DELIVERED order still
 * awaiting payment is real revenue-in-waiting but NOT money in the till, and
 * the POS deliberately keeps such orders alive (see ACTIVE_POS_QUEUE_FILTER),
 * so they are not rare. FAILED and EXPIRED never collected anything either.
 *
 * REFUNDED counts as collected on purpose. A fully refunded cash order did
 * take money in before handing it back, and the refund is subtracted
 * separately, on the day it happened. Dropping the order outright instead
 * would retroactively erase the original day's sale the moment a refund is
 * issued the following morning.
 */
export function isCollectedCashOrder(order: CashOnHandOrderInput): boolean {
  return (
    order.paymentMethod === CASH_PAYMENT_METHOD &&
    (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") &&
    !NON_REVENUE_STATUSES.includes(order.status as (typeof NON_REVENUE_STATUSES)[number])
  );
}

export interface ComputeCashOnHandInput {
  openingCash: DecimalLike;
  /**
   * Orders whose cash was taken in this window, selected by `orderDate`.
   * Callers pass them unfiltered — `isCollectedCashOrder` is applied here so
   * the rule is tested in one place.
   */
  salesOrders: CashOnHandOrderInput[];
  /**
   * Orders REFUNDED in this window, selected by `refundedAt` — NOT by
   * `orderDate`. A refund is a cash movement on the day the money leaves the
   * drawer, which is frequently not the day of the sale.
   *
   * Caveat worth knowing: `Order.refundAmount` is cumulative and `refundedAt`
   * only records the most recent refund, so an order refunded in two parts on
   * two different days attributes its whole refund total to the later day.
   * Fixing that properly needs a refund ledger, which the schema does not have.
   */
  refundedOrders: CashOnHandOrderInput[];
  movements: CashMovementInput[];
  /**
   * Cash orders in the window with no till linkage. Reported, never added —
   * see `unlinkedCashSales`. A till-scoped caller passes none: every order it
   * counts is linked to that till by definition.
   */
  unlinkedSalesOrders?: CashOnHandOrderInput[];
  /** Counted cash at close. Null/undefined while the till is open. */
  closingCash?: DecimalLike | null;
}

/**
 * The whole cash position for one window, by category.
 *
 * Every figure is reported as a positive magnitude; the formula below owns the
 * signs. That keeps the printed report readable ("Paid out  12.50") without
 * the caller having to know which lines are debits.
 */
export function computeCashOnHand({
  openingCash,
  salesOrders,
  refundedOrders,
  movements,
  unlinkedSalesOrders = [],
  closingCash = null,
}: ComputeCashOnHandInput): CashOnHandBreakdown {
  const opening = round2(Number(openingCash));

  const cashSales = round2(
    sum(salesOrders.filter(isCollectedCashOrder).map((order) => order.total))
  );

  const cashRefunds = round2(
    sum(refundedOrders.filter(isCollectedCashOrder).map((order) => order.refundAmount))
  );

  const unlinkedCashSales = round2(
    sum(unlinkedSalesOrders.filter(isCollectedCashOrder).map((order) => order.total))
  );

  const byType = (type: CashMovementType) =>
    round2(sum(movements.filter((m) => m.type === type).map((m) => m.amount)));

  const tips = byType("TIP");
  const pettyIn = byType("PETTY_IN");
  const pettyOut = byType("PETTY_OUT");
  const drops = byType("DROP");
  const tipPayouts = byType("PAYOUT");

  const expectedCash = round2(
    opening + cashSales - cashRefunds + tips + pettyIn - pettyOut - drops - tipPayouts
  );

  const counted = closingCash != null ? round2(Number(closingCash)) : null;

  return {
    openingCash: opening,
    cashSales,
    cashRefunds,
    tips,
    pettyIn,
    pettyOut,
    drops,
    tipPayouts,
    unlinkedCashSales,
    expectedCash,
    closingCash: counted,
    cashDifference: counted != null ? round2(counted - expectedCash) : null,
  };
}

/**
 * Did any cash actually move in this window?
 *
 * A store that never opens a register — takeaway-only, card-only, storefront
 * pre-paid — should not get a cash block full of zeros on its daily report.
 * Checked against the categories rather than `expectedCash`, which can land on
 * zero legitimately (a float that was fully dropped to the safe).
 */
export function hasCashActivity(breakdown: CashOnHandBreakdown, tillCount = 0): boolean {
  return (
    tillCount > 0 ||
    breakdown.openingCash > 0 ||
    breakdown.cashSales > 0 ||
    breakdown.cashRefunds > 0 ||
    breakdown.tips > 0 ||
    breakdown.pettyIn > 0 ||
    breakdown.pettyOut > 0 ||
    breakdown.drops > 0 ||
    breakdown.tipPayouts > 0 ||
    breakdown.unlinkedCashSales > 0
  );
}

/**
 * Roll several till sessions into one store-level position for a day.
 *
 * A day with two cashiers is two `Shift` rows, and "how much cash is in the
 * business at close" is their sum — a figure that previously existed nowhere.
 * Opening floats add up because each is real cash that was in a drawer.
 *
 * `closingCash` is summed only when EVERY session has been counted; one till
 * still open makes the total a half-truth, and reporting a variance against a
 * partial count would invent a shortage the size of the open drawer.
 */
export function sumCashOnHand(breakdowns: CashOnHandBreakdown[]): CashOnHandBreakdown {
  const total = (pick: (b: CashOnHandBreakdown) => number) =>
    round2(breakdowns.reduce((acc, b) => acc + pick(b), 0));

  const allCounted = breakdowns.length > 0 && breakdowns.every((b) => b.closingCash != null);
  const closingCash = allCounted ? total((b) => b.closingCash ?? 0) : null;
  const expectedCash = total((b) => b.expectedCash);

  return {
    openingCash: total((b) => b.openingCash),
    cashSales: total((b) => b.cashSales),
    cashRefunds: total((b) => b.cashRefunds),
    tips: total((b) => b.tips),
    pettyIn: total((b) => b.pettyIn),
    pettyOut: total((b) => b.pettyOut),
    drops: total((b) => b.drops),
    tipPayouts: total((b) => b.tipPayouts),
    unlinkedCashSales: total((b) => b.unlinkedCashSales),
    expectedCash,
    closingCash,
    cashDifference: closingCash != null ? round2(closingCash - expectedCash) : null,
  };
}
