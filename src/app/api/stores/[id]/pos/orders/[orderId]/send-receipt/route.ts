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
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendCustomerReceiptForOrder } from "@/lib/receipts/send-customer-receipt";
import {
  MAX_RECEIPT_SENDS_PER_ORDER,
  RECEIPT_SEND_LIMIT_REASON,
} from "@/lib/receipts/receipt-send-limit";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * `SendReceiptBody` — an optional number to send THIS receipt to, overriding
 * `Order.customerPhone` (the POS "Send receipt" screen lets the cashier type
 * one after the sale). Kept deliberately loose on format: Fonnte normalizes
 * the number itself, and rejecting a valid-but-unusual international shape
 * here would block a send that would otherwise work.
 */
const sendReceiptSchema = z.object({
  phone: z.string().trim().min(5).max(32).optional(),
});

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

    // Body is optional: the order-history "Resend" button posts `{}`, and the
    // POS complete screen posts a typed number.
    const raw = await request.json().catch(() => ({}));
    const parsed = sendReceiptSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid phone number",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const result = await sendCustomerReceiptForOrder(orderId, {
      skipAutoSendGate: true,
      skipAlreadySentGuard: true,
      expectedStoreId: storeId,
      phoneOverride: parsed.data.phone ?? null,
    });

    if (!result.sent && result.skipped) {
      if (result.reason === "order_not_found") {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
          status: 404,
        });
      }
      // A number that cannot be made into E.164 is bad input, not a silent
      // no-op — the cashier needs to see it and retype it.
      if (result.reason === "invalid_phone") {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "Enter a valid phone number"),
          { status: 400 }
        );
      }
      if (result.reason === RECEIPT_SEND_LIMIT_REASON) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.RATE_LIMIT_EXCEEDED,
            `This order has already been sent ${MAX_RECEIPT_SENDS_PER_ORDER} times`
          ),
          { status: 429 }
        );
      }
    }

    return NextResponse.json(createSuccessResponse(result));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/send-receipt",
    requireStoreAuth: true,
  }
);
