/**
 * Applying a staff-initiated refund to an order, atomically.
 *
 * Everything here runs INSIDE one transaction and the order write is a
 * conditional claim, because the read-then-write this used to be is a real
 * corruption path, not a theoretical one: two cashiers confirming the same
 * 100 refund on a 100 single-tender order at the same moment both read
 * `refundAmount = 0`, both compute `newRefundTotal = 100`, and both pass
 * `allocateRefund` (each sees `refundedAmount = 0` on the tender). The order
 * then takes an ABSOLUTE write of 100 twice — last write wins, so it looks
 * right — while the tender takes `{ increment: 100 }` twice and ends up at 200
 * on a 100 tender. `cashRefundedFromOrder` believes it, and the shift closes
 * 100 short with nothing on any screen explaining why. `allocateRefund`'s
 * TENDER_EXCEEDED guard cannot help: both callers read before either wrote.
 *
 * The fix is the claim below — `updateMany` with the exact `refundAmount` that
 * was read. Under READ COMMITTED the second transaction blocks on the row lock,
 * re-evaluates its WHERE once the first commits, matches nothing and reports
 * `count: 0`, so the caller gets a 409 and the tender increments never run.
 *
 * Split out of the route so this can be tested against a mocked transaction
 * client — the race is exactly the kind of thing that only ever shows up in
 * production, and a route with no test harness would never prove it.
 */

import type { Prisma } from "@prisma/client";
import { computeRefund } from "@/lib/finance/order-charges";
import { allocateRefund } from "@/lib/finance/order-payments";
import { reverseLoyaltyForOrder } from "@/lib/services/loyalty.service";

export interface ApplyOrderRefundInput {
  orderId: string;
  storeId: string;
  amount: number;
  reason?: string;
  /** Which OrderPayment gives the money back, on a multi-tender bill. */
  tenderId?: string;
}

export interface RefundedTenderDto {
  id: string;
  method: string;
  amount: number;
  refundedAmount: number;
}

export type ApplyOrderRefundResult =
  | {
      ok: true;
      orderNumber: string;
      paymentStatus: string;
      refundAmount: number;
      refundedAt: Date;
      refundReason: string | null;
      /** Per-tender refunded totals AFTER this refund, for the dialog's "left" figures. */
      payments: RefundedTenderDto[];
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "NOT_PAID" | "INVALID" | "CONFLICT";
      message: string;
    };

export async function applyOrderRefund(
  tx: Prisma.TransactionClient,
  { orderId, storeId, amount, reason, tenderId }: ApplyOrderRefundInput
): Promise<ApplyOrderRefundResult> {
  // Read inside the transaction: the value read is the value the claim below
  // is conditioned on, so the two cannot drift apart.
  const existing = await tx.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      payments: {
        select: { id: true, method: true, amount: true, refundedAmount: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Order not found" };

  if (existing.paymentStatus !== "PAID" && existing.paymentStatus !== "REFUNDED") {
    return { ok: false, code: "NOT_PAID", message: "Order has not been paid" };
  }

  const refund = computeRefund({
    total: Number(existing.total),
    alreadyRefunded: Number(existing.refundAmount),
    amount,
  });
  if (!refund.ok) return { ok: false, code: "INVALID", message: refund.error };

  // Which tender(s) hand the money back. Empty for an order with no rows
  // (placed before multi-tender, or a zero-total / Mark-as-Paid sale that
  // never writes one), which keeps the order-level record as its only answer.
  let allocations: Array<{ paymentId: string; amount: number }> = [];
  if (existing.payments.length > 0) {
    const allocated = allocateRefund(
      existing.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        refundedAmount: Number(p.refundedAmount),
      })),
      amount,
      tenderId
    );
    if (!allocated.ok) return { ok: false, code: "INVALID", message: allocated.message };
    allocations = allocated.allocations;
  }

  // Points earned on a refunded sale have to come back off the customer's
  // balance. The fraction passed is CUMULATIVE — total refunded after this
  // refund over the order total — because reverseLoyaltyForOrder computes a
  // DIFF against the REVERSAL entries already recorded for the order. Handing
  // it this refund's own share instead would under-reverse from the second
  // partial refund onwards.
  //
  // `isFullyRefunded` rather than a `>= 1` float comparison: the coupon
  // release inside is NOT diff-guarded and fires at fraction >= 1, so it has to
  // land on exactly the refund that flips the order to REFUNDED — the same
  // predicate used for paymentStatus below, not a division that can come out at
  // 0.9999999 on an exact full refund. It cannot fire twice: computeRefund
  // rejects any amount above `total - alreadyRefunded`, so an order that is
  // already fully refunded has nothing left to refund and never reaches here.
  //
  // A zero-total order (100% discount) has no tenders and no refundable amount
  // at all — computeRefund has already rejected it, so the guard is only about
  // not dividing by zero.
  const orderTotal = Number(existing.total);
  const refundedFraction = refund.isFullyRefunded
    ? 1
    : orderTotal > 0
      ? Math.min(1, Math.max(0, refund.newRefundTotal / orderTotal))
      : 0;

  const refundedAt = new Date();
  const paymentStatus = refund.isFullyRefunded ? "REFUNDED" : existing.paymentStatus;

  // THE CLAIM. `refundAmount` in the WHERE is the exact value read above, so
  // this matches one row only while nothing else has refunded in between.
  // Everything that follows is conditioned on it having matched.
  const claimed = await tx.order.updateMany({
    where: { id: orderId, storeId, refundAmount: existing.refundAmount },
    data: {
      refundAmount: refund.newRefundTotal,
      refundedAt,
      refundReason: reason,
      paymentStatus,
    },
  });

  if (claimed.count !== 1) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "Order was updated by someone else, retry",
    };
  }

  for (const allocation of allocations) {
    await tx.orderPayment.update({
      where: { id: allocation.paymentId },
      // `increment`, not a computed absolute: refundedAmount is cumulative and
      // sequential partial refunds must add up. Safe to increment only because
      // the claim above serialised us against any concurrent refund.
      data: { refundedAmount: { increment: allocation.amount } },
    });
  }

  if (refundedFraction > 0) {
    await reverseLoyaltyForOrder(orderId, refundedFraction, tx);
  }

  return {
    ok: true,
    orderNumber: existing.orderNumber,
    paymentStatus,
    refundAmount: refund.newRefundTotal,
    refundedAt,
    refundReason: reason ?? null,
    payments: existing.payments.map((p) => {
      const applied = allocations.find((a) => a.paymentId === p.id)?.amount ?? 0;
      return {
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        refundedAmount: Number(p.refundedAmount) + applied,
      };
    }),
  };
}
