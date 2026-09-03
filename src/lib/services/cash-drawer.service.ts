/**
 * Fetches everything the cash-on-hand figure needs and hands it to the pure
 * arithmetic in lib/finance/cash-drawer.ts.
 *
 * Single source of truth for every surface that quotes an expected drawer
 * balance — the shift-close PATCH, the live shift/daily report (browser,
 * ESC/POS and JSON), the Finance cash tab and the dashboard operations card —
 * so none of them can drift into showing a different number for the same till.
 *
 * ── Which orders belong to which drawer ──────────────────────────────────────
 *
 * Two different rules, on purpose, because two different questions are being
 * asked:
 *
 *   SALES are attributed by `Order.shiftId` linkage. That is what the cashier
 *   rang up on their till and is personally accountable for at close.
 *
 *   REFUNDS are attributed by `refundedAt` falling inside the shift's TIME
 *   WINDOW, not by the refunded order's linkage. The refunded order may well
 *   have been sold on a previous day by a different cashier — but the notes
 *   came out of whichever drawer was open when the refund was issued, and that
 *   is the drawer that will come up short. (Caveat: with two tills open at the
 *   same moment, a refund lands against both windows. A store running
 *   simultaneous tills needs a refund ledger to do better, and the schema has
 *   none — `Order` records only a cumulative `refundAmount` and the timestamp
 *   of the latest refund.)
 *
 * The store-level day rollup counts MOVEMENTS by window (they are recorded as
 * drawer events, so linkage is irrelevant) but still counts SALES by linkage,
 * for a reason worth spelling out: an unlinked CASH order is either a
 * storefront order paid at the counter, whose money is in the drawer, or a
 * delivery/aggregator order settled with a courier or the platform, whose
 * money is not — and no field in the schema distinguishes them. Adding all of
 * it to the expectation would print a shortage the size of the delivery cash;
 * dropping it silently would hide the counter cash. So it is reported on its
 * own line (`unlinkedCashSales`) for a human to reconcile, and kept out of the
 * arithmetic. That keeps `expectedCash` and the summed till counts on the same
 * scope, which is the only way the variance means anything.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  computeCashOnHand,
  sumCashOnHand,
  CASH_PAYMENT_METHOD,
  type CashOnHandBreakdown,
} from "@/lib/finance/cash-drawer";
import { resolveShiftWindow } from "@/lib/finance/shift-window";

/** Exactly the fields CashOnHandOrderInput needs — nothing heavier. */
const CASH_ORDER_SELECT = {
  paymentMethod: true,
  paymentStatus: true,
  status: true,
  total: true,
  refundAmount: true,
} as const;

/** Cash movements carry only a type and an amount into the arithmetic. */
const CASH_MOVEMENT_SELECT = { type: true, amount: true } as const;

export interface ShiftCashInput {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: Prisma.Decimal | number;
  closingCash: Prisma.Decimal | number | null;
}

/**
 * Cash position for one till session.
 *
 * `closingCashOverride` exists for the close PATCH, which needs the expected
 * figure computed against the count the cashier is submitting *right now*,
 * before that count has been written to the row.
 */
export async function getShiftCashOnHand(
  storeId: string,
  shift: ShiftCashInput,
  closingCashOverride?: number | null
): Promise<CashOnHandBreakdown> {
  const window = resolveShiftWindow(shift);

  const [salesOrders, refundedOrders, movements] = await Promise.all([
    // Rung up on THIS till.
    prisma.order.findMany({
      where: { storeId, shiftId: shift.id, paymentMethod: CASH_PAYMENT_METHOD },
      select: CASH_ORDER_SELECT,
    }),
    // Refunded while this till was open, whoever originally sold it.
    prisma.order.findMany({
      where: {
        storeId,
        paymentMethod: CASH_PAYMENT_METHOD,
        refundAmount: { gt: 0 },
        refundedAt: { gte: window.from, lte: window.to },
      },
      select: CASH_ORDER_SELECT,
    }),
    prisma.cashMovement.findMany({
      where: { storeId, shiftId: shift.id },
      select: CASH_MOVEMENT_SELECT,
    }),
  ]);

  return computeCashOnHand({
    openingCash: shift.openingCash,
    salesOrders,
    refundedOrders,
    movements,
    closingCash: closingCashOverride !== undefined ? closingCashOverride : shift.closingCash,
  });
}

export interface WindowCashOnHand {
  /** The whole store's position across the window. */
  total: CashOnHandBreakdown;
  /**
   * The till sessions that fall in the window, newest first — metadata only.
   *
   * Deliberately NOT a per-shift breakdown: this function is called with an
   * arbitrary range, and computing three scoped queries per session would turn
   * a month-long report into hundreds of round-trips to answer a question the
   * caller did not ask. A caller that genuinely needs one session's detail
   * calls getShiftCashOnHand for that session.
   */
  perShift: Array<{
    shiftId: string;
    staffName: string | null;
    openedAt: string;
    closedAt: string | null;
    isOpen: boolean;
  }>;
  /** True when at least one till in the window is still open, so the total is
   * provisional and any variance against it is meaningless. */
  hasOpenTill: boolean;
}

/**
 * Store-level cash position for an arbitrary window — the "cash in the register
 * at the end of the day" figure, which with two cashiers is the sum of two
 * tills plus everything neither till was linked to.
 *
 * Opening floats are summed from every shift OPENED in the window; each was
 * real cash physically placed in a drawer.
 *
 * ── What this figure is, and is not ─────────────────────────────────────────
 *
 * This is a *window* figure: the cash position of everything that happened
 * between `from` and `to`. For a store whose tills open and close inside one
 * calendar day — which is nearly all of them — it is also exactly the drawer
 * contents at close, because the window contains the whole session.
 *
 * For a till that SPANS the window boundary (a 20:00 → 04:00 night shift), no
 * calendar-day window can equal the drawer contents, whichever way you slice
 * it: bucket by `openedAt` and day two sees the night's later sales without
 * the float; include any overlapping till instead and day two sees the float
 * without the night's earlier sales. The two questions are genuinely
 * different, so this does not try to answer both — it answers "what did cash
 * do in this window", and `getShiftCashOnHand` answers "what is in that
 * drawer right now". The report surfaces both, and labels this one as
 * covering all tills.
 */
export async function getWindowCashOnHand(
  storeId: string,
  from: Date,
  to: Date
): Promise<WindowCashOnHand> {
  const occurredIn = { gte: from, lte: to };

  const [shifts, salesOrders, unlinkedSalesOrders, refundedOrders, movements] = await Promise.all([
    prisma.shift.findMany({
      where: { storeId, openedAt: occurredIn },
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        openingCash: true,
        closingCash: true,
        staffMember: { select: { name: true } },
      },
      orderBy: { openedAt: "desc" },
    }),
    // Rung up on some till — this is the cash a drawer can be held to.
    prisma.order.findMany({
      where: {
        storeId,
        paymentMethod: CASH_PAYMENT_METHOD,
        orderDate: occurredIn,
        shiftId: { not: null },
      },
      select: CASH_ORDER_SELECT,
    }),
    // Cash sales attributable to no till. Reported, not counted.
    prisma.order.findMany({
      where: {
        storeId,
        paymentMethod: CASH_PAYMENT_METHOD,
        orderDate: occurredIn,
        shiftId: null,
      },
      select: CASH_ORDER_SELECT,
    }),
    prisma.order.findMany({
      where: {
        storeId,
        paymentMethod: CASH_PAYMENT_METHOD,
        refundAmount: { gt: 0 },
        refundedAt: occurredIn,
      },
      select: CASH_ORDER_SELECT,
    }),
    prisma.cashMovement.findMany({
      where: { storeId, occurredAt: occurredIn },
      select: CASH_MOVEMENT_SELECT,
    }),
  ]);

  const openingCash = shifts.reduce((acc, s) => acc + Number(s.openingCash), 0);
  const hasOpenTill = shifts.some((s) => s.closedAt === null);

  // A variance is only meaningful once every drawer has actually been counted.
  // Reporting one against a partial count would invent a shortage exactly the
  // size of the till still open.
  const allCounted = shifts.length > 0 && shifts.every((s) => s.closingCash != null);
  const closingCash = allCounted ? shifts.reduce((acc, s) => acc + Number(s.closingCash), 0) : null;

  const total = computeCashOnHand({
    openingCash,
    salesOrders,
    refundedOrders,
    movements,
    unlinkedSalesOrders,
    closingCash,
  });

  const perShift = shifts.map((s) => ({
    shiftId: s.id,
    staffName: s.staffMember?.name ?? null,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    isOpen: s.closedAt === null,
  }));

  return { total, perShift, hasOpenTill };
}

/**
 * Live expected cash for every till currently open, for the dashboard
 * operations card. Returns a map keyed by shift id so the caller can merge it
 * into an existing till list without a second round of queries.
 */
export async function getOpenTillCashOnHand(
  storeId: string,
  shifts: ShiftCashInput[]
): Promise<Record<string, CashOnHandBreakdown>> {
  const breakdowns = await Promise.all(
    shifts.map(async (shift) => [shift.id, await getShiftCashOnHand(storeId, shift)] as const)
  );
  return Object.fromEntries(breakdowns);
}

export { sumCashOnHand };
