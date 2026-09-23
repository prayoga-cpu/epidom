/**
 * Cash-on-hand arithmetic.
 *
 * The heaviest coverage goes to the two rules that were previously wrong and
 * silently produced a false drawer variance every day:
 *   - an unpaid (PENDING) cash order is revenue-in-waiting, not money in the
 *     till, and must not inflate the expectation;
 *   - a refund leaves the drawer on the day it is issued, so it must not be
 *     charged back to the day of the original sale.
 */
import { describe, it, expect } from "vitest";
import {
  computeCashOnHand,
  sumCashOnHand,
  signedCashAmount,
  isCollectedCashOrder,
  cashCollectedFromOrder,
  cashRefundedFromOrder,
  hasCashActivity,
  CASH_MOVEMENT_DIRECTION,
  INBOUND_CASH_MOVEMENT_TYPES,
  OUTBOUND_CASH_MOVEMENT_TYPES,
  type CashOnHandOrderInput,
  type CashMovementInput,
} from "../cash-drawer";

function order(overrides: Partial<CashOnHandOrderInput> = {}): CashOnHandOrderInput {
  return {
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    status: "DELIVERED",
    total: 100,
    refundAmount: 0,
    ...overrides,
  };
}

function movement(type: CashMovementInput["type"], amount: number): CashMovementInput {
  return { type, amount };
}

function compute(overrides: Partial<Parameters<typeof computeCashOnHand>[0]> = {}) {
  return computeCashOnHand({
    openingCash: 0,
    salesOrders: [],
    refundedOrders: [],
    movements: [],
    ...overrides,
  });
}

describe("signedCashAmount", () => {
  it("adds tips and float top-ups, removes paid-outs, drops and payouts", () => {
    expect(signedCashAmount(movement("TIP", 10))).toBe(10);
    expect(signedCashAmount(movement("PETTY_IN", 10))).toBe(10);
    expect(signedCashAmount(movement("PETTY_OUT", 10))).toBe(-10);
    expect(signedCashAmount(movement("DROP", 10))).toBe(-10);
    expect(signedCashAmount(movement("PAYOUT", 10))).toBe(-10);
  });

  it("covers every movement type, so a new enum member cannot go unsigned", () => {
    const all = [...INBOUND_CASH_MOVEMENT_TYPES, ...OUTBOUND_CASH_MOVEMENT_TYPES].sort();
    expect(all).toEqual(Object.keys(CASH_MOVEMENT_DIRECTION).sort());
  });
});

describe("isCollectedCashOrder", () => {
  it("counts a paid cash order", () => {
    expect(isCollectedCashOrder(order())).toBe(true);
  });

  it("rejects a delivered-but-unpaid cash order", () => {
    // The regression this whole module exists for: the POS keeps DELIVERED +
    // PENDING orders alive on the Active tab, so these are common.
    expect(isCollectedCashOrder(order({ paymentStatus: "PENDING" }))).toBe(false);
  });

  it("rejects failed and expired payments", () => {
    expect(isCollectedCashOrder(order({ paymentStatus: "FAILED" }))).toBe(false);
    expect(isCollectedCashOrder(order({ paymentStatus: "EXPIRED" }))).toBe(false);
  });

  it("rejects non-cash payment methods", () => {
    expect(isCollectedCashOrder(order({ paymentMethod: "QRIS" }))).toBe(false);
    expect(isCollectedCashOrder(order({ paymentMethod: "STRIPE_CARD" }))).toBe(false);
  });

  it("rejects cancelled and held orders", () => {
    expect(isCollectedCashOrder(order({ status: "CANCELLED" }))).toBe(false);
    expect(isCollectedCashOrder(order({ status: "HELD" }))).toBe(false);
  });

  it("still counts a fully refunded cash order as having collected cash", () => {
    // It genuinely took money in; the refund is subtracted on its own day.
    expect(isCollectedCashOrder(order({ paymentStatus: "REFUNDED" }))).toBe(true);
  });
});

describe("computeCashOnHand", () => {
  it("is the opening float when nothing happened", () => {
    expect(compute({ openingCash: 50 }).expectedCash).toBe(50);
  });

  it("adds cash sales to the float", () => {
    const result = compute({ openingCash: 50, salesOrders: [order(), order({ total: 25 })] });
    expect(result.cashSales).toBe(125);
    expect(result.expectedCash).toBe(175);
  });

  it("ignores unpaid cash orders", () => {
    const result = compute({
      openingCash: 50,
      salesOrders: [order(), order({ total: 500, paymentStatus: "PENDING" })],
    });
    expect(result.cashSales).toBe(100);
    expect(result.expectedCash).toBe(150);
  });

  it("ignores non-cash orders entirely", () => {
    const result = compute({
      salesOrders: [order({ paymentMethod: "QRIS", total: 999 }), order()],
    });
    expect(result.cashSales).toBe(100);
  });

  it("subtracts refunds, reporting the magnitude positive", () => {
    const result = compute({
      openingCash: 50,
      salesOrders: [order()],
      refundedOrders: [order({ refundAmount: 30 })],
    });
    expect(result.cashRefunds).toBe(30);
    expect(result.expectedCash).toBe(120);
  });

  it("does not charge a refund back to the day of the sale", () => {
    // Day 1 sold 100 cash. Day 2 refunded it. Day 1's report must still read
    // 100 in and 0 out — the refundedOrders set is keyed on refundedAt, so it
    // is simply empty on day 1.
    const dayOne = compute({
      salesOrders: [order({ paymentStatus: "REFUNDED", refundAmount: 100 })],
    });
    expect(dayOne.cashSales).toBe(100);
    expect(dayOne.cashRefunds).toBe(0);
    expect(dayOne.expectedCash).toBe(100);

    const dayTwo = compute({
      refundedOrders: [order({ paymentStatus: "REFUNDED", refundAmount: 100 })],
    });
    expect(dayTwo.cashSales).toBe(0);
    expect(dayTwo.cashRefunds).toBe(100);
    expect(dayTwo.expectedCash).toBe(-100);
  });

  it("counts a partial refund while the order is still PAID", () => {
    const result = compute({
      salesOrders: [order()],
      refundedOrders: [order({ refundAmount: 40 })],
    });
    expect(result.cashSales).toBe(100);
    expect(result.cashRefunds).toBe(40);
    expect(result.expectedCash).toBe(60);
  });

  it("applies every movement category with the right sign", () => {
    const result = compute({
      openingCash: 100,
      movements: [
        movement("TIP", 15),
        movement("PETTY_IN", 20),
        movement("PETTY_OUT", 5),
        movement("DROP", 50),
        movement("PAYOUT", 10),
      ],
    });
    expect(result.tips).toBe(15);
    expect(result.pettyIn).toBe(20);
    expect(result.pettyOut).toBe(5);
    expect(result.drops).toBe(50);
    expect(result.tipPayouts).toBe(10);
    // 100 + 15 + 20 - 5 - 50 - 10
    expect(result.expectedCash).toBe(70);
  });

  it("sums repeated movements of the same type", () => {
    const result = compute({ movements: [movement("TIP", 5), movement("TIP", 7.5)] });
    expect(result.tips).toBe(12.5);
  });

  it("computes the full formula end to end", () => {
    const result = compute({
      openingCash: 200,
      salesOrders: [order({ total: 340.5 }), order({ total: 100, paymentStatus: "PENDING" })],
      refundedOrders: [order({ refundAmount: 20.25 })],
      movements: [movement("TIP", 30), movement("PETTY_OUT", 12.75), movement("DROP", 150)],
      closingCash: 400,
    });
    // 200 + 340.5 - 20.25 + 30 - 12.75 - 150 = 387.5
    expect(result.expectedCash).toBe(387.5);
    expect(result.closingCash).toBe(400);
    expect(result.cashDifference).toBe(12.5);
  });

  it("leaves closingCash and the variance null while the till is open", () => {
    const result = compute({ openingCash: 50, salesOrders: [order()] });
    expect(result.closingCash).toBeNull();
    expect(result.cashDifference).toBeNull();
  });

  it("reports a shortage as a negative difference", () => {
    const result = compute({ openingCash: 100, closingCash: 90 });
    expect(result.cashDifference).toBe(-10);
  });

  it("accepts Prisma Decimal-like values", () => {
    const decimal = (v: string) => ({ toString: () => v });
    const result = compute({
      openingCash: decimal("100.10"),
      salesOrders: [order({ total: decimal("50.20") })],
      movements: [movement("TIP", decimal("0.70") as never)],
    });
    expect(result.expectedCash).toBe(151);
  });

  it("rounds to two decimals rather than accumulating float drift", () => {
    const result = compute({ salesOrders: [order({ total: 0.1 }), order({ total: 0.2 })] });
    expect(result.cashSales).toBe(0.3);
  });
});

describe("unlinked cash sales", () => {
  it("is reported but never added to the expectation", () => {
    // The whole point: nothing in the schema says whether an unlinked CASH
    // order's money reached a drawer (counter cash) or a courier (delivery),
    // so counting it would print a shortage the size of the delivery cash.
    const result = compute({
      openingCash: 100,
      salesOrders: [order({ total: 50 })],
      unlinkedSalesOrders: [order({ total: 999 })],
    });
    expect(result.unlinkedCashSales).toBe(999);
    expect(result.expectedCash).toBe(150);
  });

  it("keeps the variance on the same scope as the counted cash", () => {
    // Counted 150, expected 150 -> balanced, even though 999 of unlinked cash
    // sold in the same window. Before the split this printed -999.
    const result = compute({
      openingCash: 100,
      salesOrders: [order({ total: 50 })],
      unlinkedSalesOrders: [order({ total: 999 })],
      closingCash: 150,
    });
    expect(result.cashDifference).toBe(0);
  });

  it("applies the same collected-cash filter to unlinked orders", () => {
    const result = compute({
      unlinkedSalesOrders: [
        order({ total: 100, paymentStatus: "PENDING" }),
        order({ total: 40, paymentMethod: "QRIS" }),
        order({ total: 25 }),
      ],
    });
    expect(result.unlinkedCashSales).toBe(25);
  });

  it("defaults to zero when the caller passes none", () => {
    expect(compute().unlinkedCashSales).toBe(0);
  });

  it("is summed across sessions and counts as cash activity", () => {
    const total = sumCashOnHand([
      compute({ unlinkedSalesOrders: [order({ total: 10 })] }),
      compute({ unlinkedSalesOrders: [order({ total: 5 })] }),
    ]);
    expect(total.unlinkedCashSales).toBe(15);
    expect(hasCashActivity(compute({ unlinkedSalesOrders: [order({ total: 10 })] }), 0)).toBe(true);
  });
});

/**
 * Multi-tender (release 2.88.0). The failure mode these guard against is
 * silent and expensive: a bill settled cash + card either contributes its
 * WHOLE total to the drawer (inventing the card money as notes) or nothing at
 * all (its paymentMethod is the literal "SPLIT", which matches no cash test) —
 * both print a false variance at close.
 */
describe("split-payment orders", () => {
  const split = (over: Partial<CashOnHandOrderInput> = {}) =>
    order({
      paymentMethod: "SPLIT",
      total: 100,
      payments: [
        { method: "CASH", amount: 40, refundedAmount: 0 },
        { method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
      ],
      ...over,
    });

  it("counts a split bill's cash tender, not its total and not zero", () => {
    expect(cashCollectedFromOrder(split())).toBe(40);
    expect(compute({ salesOrders: [split()] }).cashSales).toBe(40);
  });

  it("recognises a split bill as having collected cash at all", () => {
    // paymentMethod is "SPLIT" — the pre-tender check would have said no.
    expect(isCollectedCashOrder(split())).toBe(true);
  });

  it("ignores a split bill with no cash tender", () => {
    const cardOnly = split({
      payments: [
        { method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
        { method: "QRIS", amount: 40, refundedAmount: 0 },
      ],
    });
    expect(isCollectedCashOrder(cardOnly)).toBe(false);
    expect(cashCollectedFromOrder(cardOnly)).toBe(0);
  });

  it("sums several cash tenders on one bill", () => {
    const twoCash = split({
      payments: [
        { method: "CASH", amount: 30, refundedAmount: 0 },
        { method: "CASH", amount: 25, refundedAmount: 0 },
        { method: "QRIS", amount: 45, refundedAmount: 0 },
      ],
    });
    expect(cashCollectedFromOrder(twoCash)).toBe(55);
  });

  it("still applies the collected-cash gate to a split bill", () => {
    expect(cashCollectedFromOrder(split({ paymentStatus: "PENDING" }))).toBe(0);
    expect(cashCollectedFromOrder(split({ status: "CANCELLED" }))).toBe(0);
  });

  it("refunds only what came off the CASH tender", () => {
    // 60 refunded on the card: no notes left the drawer.
    const cardRefund = split({
      refundAmount: 60,
      payments: [
        { method: "CASH", amount: 40, refundedAmount: 0 },
        { method: "STRIPE_CARD", amount: 60, refundedAmount: 60 },
      ],
    });
    expect(cashRefundedFromOrder(cardRefund)).toBe(0);
    expect(compute({ refundedOrders: [cardRefund] }).cashRefunds).toBe(0);

    // 15 refunded in cash out of a 40 cash tender.
    const cashRefund = split({
      refundAmount: 15,
      payments: [
        { method: "CASH", amount: 40, refundedAmount: 15 },
        { method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
      ],
    });
    expect(cashRefundedFromOrder(cashRefund)).toBe(15);
    expect(compute({ refundedOrders: [cashRefund] }).cashRefunds).toBe(15);
  });

  it("does not fall back to the order-level refundAmount when tenders exist", () => {
    // The whole point: order.refundAmount is 60 but none of it was cash.
    const result = compute({
      openingCash: 100,
      salesOrders: [split()],
      refundedOrders: [
        split({
          refundAmount: 60,
          payments: [
            { method: "CASH", amount: 40, refundedAmount: 0 },
            { method: "STRIPE_CARD", amount: 60, refundedAmount: 60 },
          ],
        }),
      ],
    });
    expect(result.cashSales).toBe(40);
    expect(result.cashRefunds).toBe(0);
    expect(result.expectedCash).toBe(140);
  });

  it("counts a single-tender CASH order exactly as the legacy path does", () => {
    const withRow = order({
      total: 100,
      payments: [{ method: "CASH", amount: 100, refundedAmount: 0 }],
    });
    expect(cashCollectedFromOrder(withRow)).toBe(cashCollectedFromOrder(order({ total: 100 })));
  });

  it("mixes legacy and multi-tender orders in one window", () => {
    // A till that ran across the release boundary: old orders have no rows,
    // new ones do, and both have to land in the same expected figure.
    const result = compute({
      openingCash: 50,
      salesOrders: [
        order({ total: 20 }), // legacy CASH, no rows
        order({ paymentMethod: "QRIS", total: 999 }), // legacy non-cash
        split(), // 40 of 100 in cash
        order({
          paymentMethod: "CASH",
          total: 30,
          payments: [{ method: "CASH", amount: 30, refundedAmount: 0 }],
        }),
      ],
      refundedOrders: [
        order({ refundAmount: 5 }), // legacy cash refund
      ],
    });
    expect(result.cashSales).toBe(90);
    expect(result.cashRefunds).toBe(5);
    expect(result.expectedCash).toBe(135);
  });

  it("accepts Decimal-like tender amounts", () => {
    const decimal = (v: string) => ({ toString: () => v });
    const withDecimals = split({
      payments: [
        { method: "CASH", amount: decimal("40.55"), refundedAmount: decimal("0.55") },
        { method: "QRIS", amount: decimal("59.45"), refundedAmount: 0 },
      ],
    });
    expect(cashCollectedFromOrder(withDecimals)).toBe(40.55);
    expect(cashRefundedFromOrder(withDecimals)).toBe(0.55);
  });

  it("falls back to the whole order whenever no tender row exists", () => {
    // Two real cases that never write an OrderPayment: a zero-total order
    // (100% discount / fully redeemed with points) and a PAY_LATER order
    // settled later via Mark as Paid with no explicit method. Both must read
    // through the legacy path rather than being mistaken for "paid nothing".
    const freeOrder = order({ paymentMethod: "CASH", total: 0 });
    expect(isCollectedCashOrder(freeOrder)).toBe(true);
    expect(cashCollectedFromOrder(freeOrder)).toBe(0);

    const markedPaid = order({ paymentMethod: "CASH", total: 45 });
    expect(cashCollectedFromOrder(markedPaid)).toBe(45);
    expect(compute({ salesOrders: [freeOrder, markedPaid] }).cashSales).toBe(45);
  });

  it("treats a missing refundedAmount on a tender as nothing refunded", () => {
    const noRefundField = split({
      payments: [{ method: "CASH", amount: 100 }],
      refundAmount: 25,
    });
    expect(cashRefundedFromOrder(noRefundField)).toBe(0);
  });
});

describe("hasCashActivity", () => {
  it("is false for a store that never opened a register", () => {
    expect(hasCashActivity(compute(), 0)).toBe(false);
  });

  it("is true as soon as a till was opened, even with no sales", () => {
    expect(hasCashActivity(compute(), 1)).toBe(true);
  });

  it("is true for counter cash with no till session at all", () => {
    // Storefront cash collected at the counter carries shiftId: null. The day
    // report must still show a cash block for it.
    expect(hasCashActivity(compute({ salesOrders: [order()] }), 0)).toBe(true);
  });

  it("is true for a movement-only day", () => {
    expect(hasCashActivity(compute({ movements: [movement("TIP", 5)] }), 0)).toBe(true);
  });

  it("does not key off expectedCash, which can legitimately be zero", () => {
    // A float that was entirely dropped to the safe nets to zero but is very
    // much cash activity.
    const netZero = compute({ openingCash: 100, movements: [movement("DROP", 100)] });
    expect(netZero.expectedCash).toBe(0);
    expect(hasCashActivity(netZero, 0)).toBe(true);
  });
});

describe("sumCashOnHand", () => {
  const till = (over: Partial<Parameters<typeof computeCashOnHand>[0]>) => compute(over);

  it("adds every category across sessions", () => {
    const total = sumCashOnHand([
      till({
        openingCash: 100,
        salesOrders: [order({ total: 200 })],
        movements: [movement("TIP", 10)],
      }),
      till({
        openingCash: 50,
        salesOrders: [order({ total: 75 })],
        movements: [movement("DROP", 25)],
      }),
    ]);
    expect(total.openingCash).toBe(150);
    expect(total.cashSales).toBe(275);
    expect(total.tips).toBe(10);
    expect(total.drops).toBe(25);
    // (100 + 200 + 10) + (50 + 75 - 25)
    expect(total.expectedCash).toBe(410);
  });

  it("sums closingCash only when every till has been counted", () => {
    const total = sumCashOnHand([
      till({ openingCash: 100, closingCash: 110 }),
      till({ openingCash: 50 }), // still open
    ]);
    expect(total.closingCash).toBeNull();
    expect(total.cashDifference).toBeNull();
  });

  it("reports a combined variance once all tills are closed", () => {
    const total = sumCashOnHand([
      till({ openingCash: 100, closingCash: 110 }),
      till({ openingCash: 50, closingCash: 45 }),
    ]);
    expect(total.closingCash).toBe(155);
    expect(total.expectedCash).toBe(150);
    expect(total.cashDifference).toBe(5);
  });

  it("returns an all-zero position for a day with no tills", () => {
    const total = sumCashOnHand([]);
    expect(total.expectedCash).toBe(0);
    expect(total.closingCash).toBeNull();
    expect(total.cashDifference).toBeNull();
  });
});
