import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { refundOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { computeRefund } from "@/lib/finance/order-charges";

/**
 * POST /api/stores/[id]/pos/orders/[orderId]/refund
 *
 * Staff-initiated refund, recorded against the order — never triggered
 * automatically (see webhooks/xendit, which only reads REFUNDED as a
 * terminal-status guard, never writes it). Deliberately does NOT reverse
 * stock: in F&B a refund essentially never means the food comes back into
 * inventory. Supports repeat partial refunds; paymentStatus only flips to
 * REFUNDED once the cumulative refunded amount reaches the order total.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  try {
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

    publishStoreEvent(storeId, REALTIME_EVENTS.ORDER_UPDATED, {
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
  } catch (error) {
    console.error("[POS_ORDER_REFUND]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
