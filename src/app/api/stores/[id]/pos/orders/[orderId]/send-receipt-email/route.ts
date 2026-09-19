/**
 * POST /api/stores/[id]/pos/orders/[orderId]/send-receipt-email
 *
 * Email the customer their receipt — the email counterpart of the WhatsApp
 * send-receipt route, triggered from the POS "order complete" screen and from
 * order history. Like that route it is always an explicit staff action, so
 * there is no auto-send toggle and no "already sent" guard to bypass.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendReceiptEmailForOrder } from "@/lib/receipts/send-receipt-email";
import {
  MAX_RECEIPT_SENDS_PER_ORDER,
  RECEIPT_SEND_LIMIT_REASON,
} from "@/lib/receipts/receipt-send-limit";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/** `SendReceiptEmailBody` — see src/types/api/cashier.ts. */
const sendReceiptEmailSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const parsed = sendReceiptEmailSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid email address",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const result = await sendReceiptEmailForOrder(orderId, parsed.data.email, {
      expectedStoreId: storeId,
    });

    if (!result.sent && result.skipped) {
      if (result.reason === RECEIPT_SEND_LIMIT_REASON) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.RATE_LIMIT_EXCEEDED,
            `This order has already been sent ${MAX_RECEIPT_SENDS_PER_ORDER} times`
          ),
          { status: 429 }
        );
      }
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    if (!result.sent) {
      // The request was fine; the mail provider was not. 503 so the client can
      // offer a retry rather than telling the cashier they did something wrong.
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.SERVICE_UNAVAILABLE, result.error),
        { status: 503 }
      );
    }

    return NextResponse.json(createSuccessResponse({ sent: true }));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/send-receipt-email",
    requireStoreAuth: true,
  }
);
