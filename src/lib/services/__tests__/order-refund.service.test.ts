/**
 * Refund application.
 *
 * The heaviest coverage goes to the conditional claim, because the race it
 * closes silently corrupts money: two cashiers confirming the same refund at
 * the same moment both read `refundAmount = 0`, both pass the bounds check and
 * both pass allocateRefund — then the order takes an absolute write twice
 * (harmless, last one wins) while the TENDER takes `{ increment }` twice and
 * ends up refunded for double what it collected. The cash drawer believes it,
 * and the till closes short with nothing explaining why.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var reverseLoyaltyMock: any;

vi.mock("@/lib/services/loyalty.service", () => {
  reverseLoyaltyMock = vi.fn().mockResolvedValue(undefined);
  return { reverseLoyaltyForOrder: reverseLoyaltyMock };
});

import { applyOrderRefund } from "../order-refund.service";

interface TxOptions {
  order?: Record<string, unknown> | null;
  /** Rows the conditional claim reports as matched. 0 = someone else got there first. */
  claimCount?: number;
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "POS-0001",
    storeId: "store-1",
    total: 100,
    refundAmount: 0,
    paymentStatus: "PAID",
    payments: [{ id: "pay-1", method: "CASH", amount: 100, refundedAmount: 0 }],
    ...overrides,
  };
}

function makeTx({ order = makeOrder(), claimCount = 1 }: TxOptions = {}) {
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue(order),
      updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
    },
    orderPayment: { update: vi.fn().mockResolvedValue({}) },
  } as any;
}

const INPUT = { orderId: "order-1", storeId: "store-1", amount: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  reverseLoyaltyMock.mockResolvedValue(undefined);
});

describe("applyOrderRefund — concurrency claim", () => {
  it("conditions the order write on the refundAmount it read", async () => {
    const tx = makeTx({ order: makeOrder({ refundAmount: 25 }) });
    await applyOrderRefund(tx, { ...INPUT, amount: 50 });

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", storeId: "store-1", refundAmount: 25 },
      })
    );
  });

  it("returns CONFLICT and writes NOTHING when another refund got there first", async () => {
    const tx = makeTx({ claimCount: 0 });

    const result = await applyOrderRefund(tx, INPUT);

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Order was updated by someone else, retry",
    });
    // The two writes that would corrupt the drawer if they ran anyway.
    expect(tx.orderPayment.update).not.toHaveBeenCalled();
    expect(reverseLoyaltyMock).not.toHaveBeenCalled();
  });

  it("increments the tender only after the claim succeeds", async () => {
    const tx = makeTx();
    const result = await applyOrderRefund(tx, INPUT);

    expect(result.ok).toBe(true);
    expect(tx.orderPayment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { refundedAmount: { increment: 100 } },
    });
    expect(tx.order.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.orderPayment.update.mock.invocationCallOrder[0]
    );
  });

  it("scopes the read to the store, so another tenant's order is never refundable", async () => {
    const tx = makeTx();
    await applyOrderRefund(tx, INPUT);
    expect(tx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1", storeId: "store-1" } })
    );
  });
});

describe("applyOrderRefund — guards", () => {
  it("404s an order that does not exist in this store", async () => {
    const tx = makeTx({ order: null });
    const result = await applyOrderRefund(tx, INPUT);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an order that was never paid", async () => {
    const tx = makeTx({ order: makeOrder({ paymentStatus: "PENDING" }) });
    const result = await applyOrderRefund(tx, INPUT);
    expect(result).toMatchObject({ ok: false, code: "NOT_PAID" });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a refund beyond what is left on the order", async () => {
    const tx = makeTx({ order: makeOrder({ refundAmount: 80 }) });
    const result = await applyOrderRefund(tx, { ...INPUT, amount: 50 });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a partial refund on a split bill with no tender named", async () => {
    const tx = makeTx({
      order: makeOrder({
        payments: [
          { id: "pay-cash", method: "CASH", amount: 40, refundedAmount: 0 },
          { id: "pay-card", method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
        ],
      }),
    });
    const result = await applyOrderRefund(tx, { ...INPUT, amount: 40 });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(tx.orderPayment.update).not.toHaveBeenCalled();
  });
});

describe("applyOrderRefund — attribution and loyalty", () => {
  it("puts a split-bill refund on the named tender only", async () => {
    const tx = makeTx({
      order: makeOrder({
        payments: [
          { id: "pay-cash", method: "CASH", amount: 40, refundedAmount: 0 },
          { id: "pay-card", method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
        ],
      }),
    });

    const result = await applyOrderRefund(tx, { ...INPUT, amount: 40, tenderId: "pay-cash" });

    expect(result.ok).toBe(true);
    expect(tx.orderPayment.update).toHaveBeenCalledTimes(1);
    expect(tx.orderPayment.update).toHaveBeenCalledWith({
      where: { id: "pay-cash" },
      data: { refundedAmount: { increment: 40 } },
    });
  });

  it("passes the CUMULATIVE fraction, not this refund's share", async () => {
    // 25 already refunded, 50 more now: the reversal must see 75/100.
    const tx = makeTx({ order: makeOrder({ refundAmount: 25 }) });
    await applyOrderRefund(tx, { ...INPUT, amount: 50 });

    expect(reverseLoyaltyMock).toHaveBeenCalledWith("order-1", 0.75, tx);
  });

  it("passes exactly 1 on the refund that completes the order", async () => {
    // Float division on these figures lands under 1; the coupon release inside
    // reverseLoyaltyForOrder is not diff-guarded and fires only at >= 1, so it
    // has to be pinned to the same predicate that writes REFUNDED.
    const tx = makeTx({
      order: makeOrder({ total: 0.3, refundAmount: 0.1, payments: [] }),
    });
    const result = await applyOrderRefund(tx, { ...INPUT, amount: 0.2 });

    expect(result).toMatchObject({ ok: true, paymentStatus: "REFUNDED" });
    expect(reverseLoyaltyMock).toHaveBeenCalledWith("order-1", 1, tx);
  });

  it("keeps a partial refund PAID and reports the new cumulative total", async () => {
    const tx = makeTx();
    const result = await applyOrderRefund(tx, { ...INPUT, amount: 30 });

    expect(result).toMatchObject({
      ok: true,
      paymentStatus: "PAID",
      refundAmount: 30,
      orderNumber: "POS-0001",
    });
  });

  it("handles an order with no tender rows exactly as before", async () => {
    const tx = makeTx({ order: makeOrder({ payments: [] }) });
    const result = await applyOrderRefund(tx, INPUT);

    expect(result).toMatchObject({ ok: true, paymentStatus: "REFUNDED", payments: [] });
    expect(tx.orderPayment.update).not.toHaveBeenCalled();
    // The order-level record is still the whole answer for a legacy order.
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refundAmount: 100 }) })
    );
  });

  it("reports each tender's refunded total after this refund", async () => {
    const tx = makeTx({
      order: makeOrder({
        payments: [
          { id: "pay-cash", method: "CASH", amount: 40, refundedAmount: 10 },
          { id: "pay-card", method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
        ],
        refundAmount: 10,
      }),
    });

    const result = await applyOrderRefund(tx, { ...INPUT, amount: 20, tenderId: "pay-cash" });

    expect(result.ok && result.payments).toEqual([
      { id: "pay-cash", method: "CASH", amount: 40, refundedAmount: 30 },
      { id: "pay-card", method: "STRIPE_CARD", amount: 60, refundedAmount: 0 },
    ]);
  });
});
