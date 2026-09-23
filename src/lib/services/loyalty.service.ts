import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pointsEarnedFor, type LoyaltyRules } from "@/lib/finance/discounts";

/**
 * Loyalty points and coupon-usage bookkeeping.
 *
 * `Customer.points` is a CACHE; the `LoyaltyEntry` rows are the ledger behind
 * it, and every balance change in this file writes both in the same
 * transaction. Nothing here ever runs outside a transaction: a points burn
 * that commits without its ledger row (or a coupon `usedCount` bump without
 * the order that used it) is unrecoverable.
 *
 * Every balance-changing write is a CONDITIONAL `updateMany` rather than a
 * read-then-write: two tills can ring up the same customer (or the last use of
 * a coupon) concurrently, and a read-modify-write would let both succeed.
 * `count !== 1` means somebody else won the race, which the callers surface as
 * a 422 rather than silently over-spending.
 */

/** Either the request-scoped client or a transaction client. */
type LoyaltyDb = Prisma.TransactionClient | typeof prisma;

/**
 * What a store with no StoreLoyaltySettings row behaves like: loyalty off.
 * Resolved here (never null) so callers don't each invent their own fallback.
 */
export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  enabled: false,
  spendPerPoint: 0,
  pointValue: 0,
  minRedeemPoints: 0,
};

/** Somebody else won a race for the same points / the last coupon use. */
export class LoyaltyConflictError extends Error {}

export async function getLoyaltyRules(
  storeId: string,
  tx?: Prisma.TransactionClient
): Promise<LoyaltyRules> {
  const db: LoyaltyDb = tx ?? prisma;
  const row = await db.storeLoyaltySettings.findUnique({ where: { storeId } });
  if (!row) return { ...DEFAULT_LOYALTY_RULES };
  return {
    enabled: row.enabled,
    // Decimal → number at the edge of the DB, exactly like order money: the
    // pure math in src/lib/finance/discounts.ts is number-based so the cart
    // preview and the server agree to the cent.
    spendPerPoint: Number(row.spendPerPoint),
    pointValue: Number(row.pointValue),
    minRedeemPoints: row.minRedeemPoints,
  };
}

/**
 * Burn `points` off a customer's balance for an order, writing the REDEEM
 * ledger row. The balance condition (`points >= n`) is what makes this safe
 * against a second till spending the same points.
 */
export async function redeemPointsForOrder(
  args: { customerId: string; storeId: string; orderId: string; points: number; note?: string },
  tx: Prisma.TransactionClient
): Promise<void> {
  if (!(args.points > 0)) return;

  const claimed = await tx.customer.updateMany({
    where: { id: args.customerId, storeId: args.storeId, points: { gte: args.points } },
    data: { points: { decrement: args.points } },
  });
  if (claimed.count !== 1) {
    throw new LoyaltyConflictError("Not enough points on this customer");
  }

  await tx.loyaltyEntry.create({
    data: {
      customerId: args.customerId,
      orderId: args.orderId,
      type: "REDEEM",
      // Signed ledger: a burn is negative so SUM(points) is the balance.
      points: -args.points,
      note: args.note ?? null,
    },
  });
}

/**
 * Claim one use of a coupon. `maxUses` is the value read alongside the coupon
 * in the same request — comparing against that literal inside the WHERE is
 * what makes the last use atomic (Prisma can't compare two columns here, and
 * a read-then-write would let two tills both take use #10 of 10).
 */
export async function consumeCouponUse(
  args: { couponId: string; storeId: string; maxUses: number | null },
  tx: Prisma.TransactionClient
): Promise<void> {
  const claimed = await tx.coupon.updateMany({
    where: {
      id: args.couponId,
      storeId: args.storeId,
      ...(args.maxUses != null ? { usedCount: { lt: args.maxUses } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new LoyaltyConflictError("This coupon has already been fully used");
  }
}

/**
 * Give a coupon use back (order cancelled / fully refunded). Floored at zero
 * so a stray double-release can never push `usedCount` negative and hand out
 * a free extra use.
 */
export async function releaseCouponUse(
  args: { couponId: string; storeId: string },
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.coupon.updateMany({
    where: { id: args.couponId, storeId: args.storeId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}

/**
 * Credit the customer for a PAID order. Called from every path that can flip
 * an order to PAID — creation, finalize, "Mark as Paid" and the Xendit webhook
 * — so it has to be safe to call more than once for the same order.
 *
 * IDEMPOTENCY: the conditional `updateMany({ where: { id, pointsEarned: 0 } })`
 * is the claim. Only the caller whose update affected exactly one row goes on
 * to write the EARN row and bump the balance; a concurrent (or retried) call
 * sees 0 rows affected and returns 0 having written nothing.
 *
 * Returns the points credited (0 when nothing was due or another call won).
 */
export async function earnPointsForOrder(
  orderId: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  if (tx) return earnPointsWithin(tx, orderId);
  return prisma.$transaction((t) => earnPointsWithin(t, orderId));
}

async function earnPointsWithin(tx: Prisma.TransactionClient, orderId: string): Promise<number> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      storeId: true,
      customerId: true,
      total: true,
      refundAmount: true,
      pointsEarned: true,
      paymentStatus: true,
      status: true,
    },
  });

  // No customer to credit, not actually paid, already credited, or dead.
  if (!order?.customerId) return 0;
  if (order.paymentStatus !== "PAID") return 0;
  if (order.status === "CANCELLED") return 0;
  if (order.pointsEarned > 0) return 0;

  const rules = await getLoyaltyRules(order.storeId, tx);
  // What the customer actually paid: a refund issued before this ran (rare,
  // but possible on the webhook path) must not earn points back.
  const paid = Math.max(Number(order.total) - Number(order.refundAmount), 0);
  const points = pointsEarnedFor(paid, rules);
  if (points <= 0) return 0;

  const claimed = await tx.order.updateMany({
    where: { id: orderId, pointsEarned: 0 },
    data: { pointsEarned: points },
  });
  if (claimed.count !== 1) return 0;

  await tx.loyaltyEntry.create({
    data: { customerId: order.customerId, orderId, type: "EARN", points },
  });
  await tx.customer.update({
    where: { id: order.customerId },
    data: { points: { increment: points } },
  });
  // "Loyalty member since" is the first time points were ever earned — set
  // separately (and conditionally) so a repeat customer keeps their original
  // date instead of having it pushed forward on every visit.
  await tx.customer.updateMany({
    where: { id: order.customerId, memberSince: null },
    data: { memberSince: new Date() },
  });

  return points;
}

/**
 * Unwind the loyalty side of an order that was cancelled or refunded:
 * `fraction` of the points it earned are taken back and `fraction` of the
 * points it burned are given back, as one net REVERSAL ledger entry.
 *
 * IDEMPOTENCY GUARANTEE (the one chosen here, deliberately):
 * point reversal is computed as a DIFF against the REVERSAL entries already
 * recorded for this order, so calling it twice with the same fraction is a
 * no-op the second time, and calling it with a growing fraction (repeat
 * partial refunds) only ever reverses the increment. The balance is clamped so
 * it can never go negative — a customer who already spent the points they
 * earned on this order keeps the shortfall rather than going into debt, and a
 * later call simply reverses whatever is by then affordable.
 *
 * The COUPON release is NOT diff-guarded (there is nowhere to record "already
 * released" — LoyaltyEntry requires a customer and a coupon order may have
 * none). It fires whenever `fraction >= 1`, floored at zero, so callers must
 * invoke this only on the transition that first makes the order fully
 * cancelled/refunded — which is what the cancel guard ("Order is already
 * cancelled") and computeRefund's `isFullyRefunded` already give them.
 *
 * `tx` is optional only so a caller with no transaction of its own can use it;
 * pass one whenever the reversal must commit with the rest of the change.
 */
export async function reverseLoyaltyForOrder(
  orderId: string,
  fraction: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  if (tx) {
    await reverseLoyaltyWithin(tx, orderId, fraction);
    return;
  }
  await prisma.$transaction((t) => reverseLoyaltyWithin(t, orderId, fraction));
}

async function reverseLoyaltyWithin(
  tx: Prisma.TransactionClient,
  orderId: string,
  fraction: number
): Promise<void> {
  const f = Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0;
  if (f <= 0) return;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      storeId: true,
      customerId: true,
      couponId: true,
      pointsEarned: true,
      pointsRedeemed: true,
    },
  });
  if (!order) return;

  if (order.customerId && (order.pointsEarned > 0 || order.pointsRedeemed > 0)) {
    const prior = await tx.loyaltyEntry.aggregate({
      where: { orderId, type: "REVERSAL" },
      _sum: { points: true },
    });
    const alreadyReversed = prior._sum.points ?? 0;

    // Net effect this fraction should have had on the balance: give redeemed
    // points back (+), take earned points away (−).
    const target = Math.round(order.pointsRedeemed * f) - Math.round(order.pointsEarned * f);
    let delta = target - alreadyReversed;

    if (delta < 0) {
      const customer = await tx.customer.findUnique({
        where: { id: order.customerId },
        select: { points: true },
      });
      // Never overdraw: take back at most what is actually on the balance.
      delta = -Math.min(-delta, customer?.points ?? 0);
    }

    if (delta !== 0) {
      await tx.customer.update({
        where: { id: order.customerId },
        data: { points: { increment: delta } },
      });
      await tx.loyaltyEntry.create({
        data: {
          customerId: order.customerId,
          orderId,
          type: "REVERSAL",
          points: delta,
          note: f >= 1 ? "Order cancelled/refunded" : `Partial reversal (${Math.round(f * 100)}%)`,
        },
      });
    }
  }

  if (f >= 1 && order.couponId) {
    await releaseCouponUse({ couponId: order.couponId, storeId: order.storeId }, tx);
  }
}
