/**
 * POST /api/stores/[id]/pos/orders/[orderId]/send-receipt
 *
 * Manual "Send/Resend receipt via WhatsApp" — used from order history when a
 * store has auto-send turned off, or to retry after a FAILED attempt. Unlike
 * the automatic Inngest job (send-customer-receipt.ts), this bypasses the
 * store's auto-send toggle and the "already sent" guard, since triggering it
 * at all is already an explicit staff action.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCustomerReceiptForOrder } from "@/lib/receipts/send-customer-receipt";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/** The send-attempt log for this order — most recent first, for the order-history "already sent" state. */
export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    const sends = await prisma.orderReceiptSend.findMany({
      where: { orderId },
      orderBy: { sentAt: "desc" },
    });
    return NextResponse.json(createSuccessResponse(sends));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/send-receipt",
    requireStoreAuth: true,
  }
);

export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const result = await sendCustomerReceiptForOrder(orderId, {
      skipAutoSendGate: true,
      skipAlreadySentGuard: true,
      expectedStoreId: storeId,
    });

    if (!result.sent && result.skipped && result.reason === "order_not_found") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    return NextResponse.json(createSuccessResponse(result));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/send-receipt",
    requireStoreAuth: true,
  }
);
