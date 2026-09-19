import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when the vi.mock factory is hoisted above the
// declaration. The same object doubles as the transaction client, which is
// exactly how the service uses it (`tx ?? prisma`).

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    storeLoyaltySettings: { findUnique: vi.fn() },
    customer: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    loyaltyEntry: { create: vi.fn(), aggregate: vi.fn() },
    coupon: { updateMany: vi.fn() },
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(prismaMock)),
  };
  return { prisma: prismaMock };
});

import {
  DEFAULT_LOYALTY_RULES,
  LoyaltyConflictError,
  consumeCouponUse,
  earnPointsForOrder,
  getLoyaltyRules,
  redeemPointsForOrder,
  releaseCouponUse,
  reverseLoyaltyForOrder,
} from "../loyalty.service";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.loyaltyEntry.aggregate.mockResolvedValue({ _sum: { points: null } });
  prismaMock.customer.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.coupon.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
});

describe("getLoyaltyRules", () => {
  it("resolves to 'loyalty off' when the store has no settings row", async () => {
    prismaMock.storeLoyaltySettings.findUnique.mockResolvedValue(null);
    await expect(getLoyaltyRules("store-1")).resolves.toEqual(DEFAULT_LOYALTY_RULES);
  });

  it("converts the stored Decimals to numbers", async () => {
    prismaMock.storeLoyaltySettings.findUnique.mockResolvedValue({
      enabled: true,
      // Decimal columns come back as objects/strings; the pure discount math
      // is number-based, so anything unconverted silently concatenates.
      spendPerPoint: "10",
      pointValue: "0.5",
      minRedeemPoints: 20,
    });
    await expect(getLoyaltyRules("store-1")).resolves.toEqual({
      enabled: true,
      spendPerPoint: 10,
      pointValue: 0.5,
      minRedeemPoints: 20,
    });
  });
});

describe("redeemPointsForOrder", () => {
  it("burns the points conditionally and writes a negative ledger row", async () => {
    await redeemPointsForOrder(
      { customerId: "cus-1", storeId: "store-1", orderId: "ord-1", points: 40 },
      prismaMock
    );

    // The balance condition is what stops two tills spending the same points.
    expect(prismaMock.customer.updateMany).toHaveBeenCalledWith({
      where: { id: "cus-1", storeId: "store-1", points: { gte: 40 } },
      data: { points: { decrement: 40 } },
    });
    expect(prismaMock.loyaltyEntry.create).toHaveBeenCalledWith({
      data: {
        customerId: "cus-1",
        orderId: "ord-1",
        type: "REDEEM",
        points: -40,
        note: null,
      },
    });
  });

  it("throws (and writes no ledger row) when another till won the race", async () => {
    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      redeemPointsForOrder(
        { customerId: "cus-1", storeId: "store-1", orderId: "ord-1", points: 40 },
        prismaMock
      )
    ).rejects.toBeInstanceOf(LoyaltyConflictError);
    expect(prismaMock.loyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("is a no-op for zero points", async () => {
    await redeemPointsForOrder(
      { customerId: "cus-1", storeId: "store-1", orderId: "ord-1", points: 0 },
      prismaMock
    );
    expect(prismaMock.customer.updateMany).not.toHaveBeenCalled();
  });
});

describe("consumeCouponUse / releaseCouponUse", () => {
  it("guards the increment on usedCount < maxUses", async () => {
    await consumeCouponUse({ couponId: "cp-1", storeId: "store-1", maxUses: 10 }, prismaMock);
    expect(prismaMock.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "cp-1", storeId: "store-1", usedCount: { lt: 10 } },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("drops the guard entirely for an unlimited coupon", async () => {
    await consumeCouponUse({ couponId: "cp-1", storeId: "store-1", maxUses: null }, prismaMock);
    expect(prismaMock.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "cp-1", storeId: "store-1" },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("throws when the last use was taken by someone else", async () => {
    prismaMock.coupon.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      consumeCouponUse({ couponId: "cp-1", storeId: "store-1", maxUses: 1 }, prismaMock)
    ).rejects.toBeInstanceOf(LoyaltyConflictError);
  });

  it("never lets a release push usedCount below zero", async () => {
    await releaseCouponUse({ couponId: "cp-1", storeId: "store-1" }, prismaMock);
    expect(prismaMock.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "cp-1", storeId: "store-1", usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});

describe("earnPointsForOrder", () => {
  const paidOrder = {
    storeId: "store-1",
    customerId: "cus-1",
    total: "100",
    refundAmount: "0",
    pointsEarned: 0,
    paymentStatus: "PAID",
    status: "DELIVERED",
  };

  beforeEach(() => {
    prismaMock.storeLoyaltySettings.findUnique.mockResolvedValue({
      enabled: true,
      spendPerPoint: "10",
      pointValue: "0.5",
      minRedeemPoints: 0,
    });
  });

  it("credits points, writes the EARN row and stamps memberSince once", async () => {
    prismaMock.order.findUnique.mockResolvedValue(paidOrder);

    await expect(earnPointsForOrder("ord-1")).resolves.toBe(10);

    // The conditional update IS the idempotency claim.
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "ord-1", pointsEarned: 0 },
      data: { pointsEarned: 10 },
    });
    expect(prismaMock.loyaltyEntry.create).toHaveBeenCalledWith({
      data: { customerId: "cus-1", orderId: "ord-1", type: "EARN", points: 10 },
    });
    expect(prismaMock.customer.update).toHaveBeenCalledWith({
      where: { id: "cus-1" },
      data: { points: { increment: 10 } },
    });
    // memberSince is only ever set the FIRST time, so a repeat customer keeps
    // their original date.
    expect(prismaMock.customer.updateMany).toHaveBeenCalledWith({
      where: { id: "cus-1", memberSince: null },
      data: { memberSince: expect.any(Date) },
    });
  });

  it("is idempotent: an order that already earned credits nothing", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...paidOrder, pointsEarned: 10 });

    await expect(earnPointsForOrder("ord-1")).resolves.toBe(0);
    expect(prismaMock.loyaltyEntry.create).not.toHaveBeenCalled();
    expect(prismaMock.customer.update).not.toHaveBeenCalled();
  });

  it("writes nothing when a concurrent call won the claim", async () => {
    prismaMock.order.findUnique.mockResolvedValue(paidOrder);
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(earnPointsForOrder("ord-1")).resolves.toBe(0);
    expect(prismaMock.loyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("does not earn on an unpaid, cancelled or customer-less order", async () => {
    for (const override of [
      { paymentStatus: "PENDING" },
      { status: "CANCELLED" },
      { customerId: null },
    ]) {
      vi.clearAllMocks();
      prismaMock.storeLoyaltySettings.findUnique.mockResolvedValue({
        enabled: true,
        spendPerPoint: "10",
        pointValue: "0.5",
        minRedeemPoints: 0,
      });
      prismaMock.order.findUnique.mockResolvedValue({ ...paidOrder, ...override });
      await expect(earnPointsForOrder("ord-1")).resolves.toBe(0);
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    }
  });

  it("earns on what was actually kept, not the gross total", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...paidOrder,
      total: "100",
      refundAmount: "60",
    });
    await expect(earnPointsForOrder("ord-1")).resolves.toBe(4);
  });

  it("earns nothing when the store has loyalty off", async () => {
    prismaMock.storeLoyaltySettings.findUnique.mockResolvedValue(null);
    prismaMock.order.findUnique.mockResolvedValue(paidOrder);
    await expect(earnPointsForOrder("ord-1")).resolves.toBe(0);
  });
});

describe("reverseLoyaltyForOrder", () => {
  const order = {
    storeId: "store-1",
    customerId: "cus-1",
    couponId: "cp-1",
    pointsEarned: 10,
    pointsRedeemed: 40,
  };

  it("gives back what was burned and takes back what was earned, in one entry", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.customer.findUnique.mockResolvedValue({ points: 500 });

    await reverseLoyaltyForOrder("ord-1", 1, prismaMock);

    // +40 given back, −10 taken back ⇒ net +30.
    expect(prismaMock.customer.update).toHaveBeenCalledWith({
      where: { id: "cus-1" },
      data: { points: { increment: 30 } },
    });
    expect(prismaMock.loyaltyEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "REVERSAL", points: 30, orderId: "ord-1" }),
    });
    // A full reversal also hands the coupon use back.
    expect(prismaMock.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "cp-1", storeId: "store-1", usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  it("is idempotent — a second identical call writes nothing to the balance", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    // The first call's REVERSAL row is now in the ledger.
    prismaMock.loyaltyEntry.aggregate.mockResolvedValue({ _sum: { points: 30 } });

    await reverseLoyaltyForOrder("ord-1", 1, prismaMock);

    expect(prismaMock.customer.update).not.toHaveBeenCalled();
    expect(prismaMock.loyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("only reverses the increment on a growing partial refund", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, pointsRedeemed: 0 });
    prismaMock.customer.findUnique.mockResolvedValue({ points: 500 });
    // Half was already reversed (−5 of the 10 earned).
    prismaMock.loyaltyEntry.aggregate.mockResolvedValue({ _sum: { points: -5 } });

    await reverseLoyaltyForOrder("ord-1", 1, prismaMock);

    expect(prismaMock.customer.update).toHaveBeenCalledWith({
      where: { id: "cus-1" },
      data: { points: { increment: -5 } },
    });
  });

  it("clamps the claw-back so the balance can never go negative", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...order,
      pointsEarned: 100,
      pointsRedeemed: 0,
    });
    // The customer already spent most of what this order earned.
    prismaMock.customer.findUnique.mockResolvedValue({ points: 30 });

    await reverseLoyaltyForOrder("ord-1", 1, prismaMock);

    expect(prismaMock.customer.update).toHaveBeenCalledWith({
      where: { id: "cus-1" },
      data: { points: { increment: -30 } },
    });
  });

  it("does not release the coupon on a partial reversal", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.customer.findUnique.mockResolvedValue({ points: 500 });

    await reverseLoyaltyForOrder("ord-1", 0.5, prismaMock);

    expect(prismaMock.coupon.updateMany).not.toHaveBeenCalled();
  });

  it("ignores a zero/negative fraction entirely", async () => {
    await reverseLoyaltyForOrder("ord-1", 0, prismaMock);
    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
  });

  it("still releases the coupon for an order with no customer", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...order,
      customerId: null,
      pointsEarned: 0,
      pointsRedeemed: 0,
    });

    await reverseLoyaltyForOrder("ord-1", 1, prismaMock);

    expect(prismaMock.loyaltyEntry.create).not.toHaveBeenCalled();
    expect(prismaMock.coupon.updateMany).toHaveBeenCalled();
  });
});
