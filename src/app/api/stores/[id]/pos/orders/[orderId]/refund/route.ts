import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { refundOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { computeRefund } from "@/lib/finance/order-charges";
import { recordAction } from "@/lib/audit/record";

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
    const parsed = refundOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid refund data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { amount, reason } = parsed.data;

    const existing = await prisma.order.findFirst({ where: { id: orderId, storeId } });
    if (!existing) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    if (existing.paymentStatus !== "PAID" && existing.paymentStatus !== "REFUNDED") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Order has not been paid"),
        { status: 400 }
      );
    }

    const refund = computeRefund({
      total: Number(existing.total),
      alreadyRefunded: Number(existing.refundAmount),
      amount,
    });

    if (!refund.ok) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, refund.error), {
        status: 400,
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        refundAmount: refund.newRefundTotal,
        refundedAt: new Date(),
        refundReason: reason,
        paymentStatus: refund.isFullyRefunded ? "REFUNDED" : existing.paymentStatus,
      },
    });

    await recordAction({
      actionType: "pos.order.refund",
      storeId: storeId!,
      targetId: orderId,
      payload: {
        storeId: storeId!,
        orderId,
        orderNumber: existing.orderNumber,
        amount: amount.toString(),
        reason: reason ?? null,
      },
    });

    publishStoreEvent(storeId!, REALTIME_EVENTS.ORDER_UPDATED, {
      action: "updated",
      entityId: updated.id,
    });

    return NextResponse.json(
      createSuccessResponse({
        id: updated.id,
        paymentStatus: updated.paymentStatus,
        refundAmount: Number(updated.refundAmount),
        refundedAt: updated.refundedAt,
        refundReason: updated.refundReason,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/refund", requireStoreAuth: true }
);
