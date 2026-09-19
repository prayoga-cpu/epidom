import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { refundOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { applyOrderRefund } from "@/lib/services/order-refund.service";
import { recordAction } from "@/lib/audit/record";

/**
 * `tenderId` names which `OrderPayment` gives the money back on a bill that
 * was settled with more than one tender — a cash refund leaves the drawer, a
 * card refund does not, and the cash-drawer arithmetic reads the per-tender
 * `refundedAmount` to tell them apart.
 *
 * Extended here rather than in `refundOrderSchema` itself so this route owns
 * the one field only it understands; `z.object` strips unknown keys, so the
 * field genuinely has to be declared somewhere for it to survive parsing.
 */
const refundWithTenderSchema = refundOrderSchema.extend({
  tenderId: z.string().min(1).optional(),
});

/**
 * POST /api/stores/[id]/pos/orders/[orderId]/refund
 *
 * Staff-initiated refund, recorded against the order — never triggered
 * automatically (see webhooks/xendit, which only reads REFUNDED as a
 * terminal-status guard, never writes it). Deliberately does NOT reverse
 * stock: in F&B a refund essentially never means the food comes back into
 * inventory. Supports repeat partial refunds; paymentStatus only flips to
 * REFUNDED once the cumulative refunded amount reaches the order total.
 *
 * Multi-tender: the order-level bounds/`refundAmount`/`refundedAt`/REFUNDED
 * logic is unchanged, and an order with no `OrderPayment` rows (everything
 * placed before release 2.88.0 — there is no backfill) behaves exactly as it
 * did. When rows exist the refund is additionally attributed to one of them.
 *
 * The read, the bounds checks, the tender allocation and every write live in
 * ONE transaction in order-refund.service.ts, behind a conditional claim on the
 * `refundAmount` that was read — two cashiers confirming the same refund at the
 * same moment used to double the tender's `refundedAmount` and leave the till
 * short. The loser of that race gets a 409 here.
 *
 * Converted from a hand-rolled auth/verification block to withApiHandler as
 * part of the audit-trail Phase 0 cleanup (docs/AUDIT_LOG_PLAN.md) — this was
 * one of the routes that bypassed the wrapper and so bypassed the activity
 * trail entirely. Recorded as COMPENSATE_ONLY: the money has already moved at
 * the payment provider, so a generic revert would falsify the financial
 * record rather than fix it — the remedy is a correcting transaction, which
 * the log points operators at.
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const body = await request.json();
    const parsed = refundWithTenderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid refund data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { amount, reason, tenderId } = parsed.data;

    const result = await prisma.$transaction((tx) =>
      applyOrderRefund(tx, { orderId, storeId: storeId!, amount, reason, tenderId })
    );

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND" ? 404 : result.code === "CONFLICT" ? 409 : 400;
      const errorCode =
        result.code === "NOT_FOUND"
          ? ApiErrorCode.NOT_FOUND
          : result.code === "CONFLICT"
            ? ApiErrorCode.CONFLICT
            : ApiErrorCode.INVALID_INPUT;
      return NextResponse.json(createErrorResponse(errorCode, result.message), { status });
    }

    await recordAction({
      actionType: "pos.order.refund",
      storeId: storeId!,
      targetId: orderId,
      payload: {
        storeId: storeId!,
        orderId,
        orderNumber: result.orderNumber,
        amount: amount.toString(),
        reason: reason ?? null,
        tenderId: tenderId ?? null,
      },
    });

    publishStoreEvent(storeId!, REALTIME_EVENTS.ORDER_UPDATED, {
      action: "updated",
      entityId: orderId,
    });

    return NextResponse.json(
      createSuccessResponse({
        id: orderId,
        paymentStatus: result.paymentStatus,
        refundAmount: result.refundAmount,
        refundedAt: result.refundedAt,
        refundReason: result.refundReason,
        payments: result.payments,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/refund", requireStoreAuth: true }
);
