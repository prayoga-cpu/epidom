import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseXenditWebhook, type XenditWebhookPayload } from "@/lib/payments/providers/xendit";
import { deductStockForOrder } from "@/lib/services/stock-deduction.service";
import { inngest } from "@/lib/inngest/client";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

function verifyXenditToken(request: Request): boolean {
  const callbackToken = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!callbackToken) return true; // Allow if not configured (dev mode)

  const header = request.headers.get("x-callback-token");
  return header === callbackToken;
}

export async function POST(request: Request) {
  if (!verifyXenditToken(request)) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Invalid callback token"),
      { status: 401 }
    );
  }

  let payload: XenditWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid JSON payload"),
      { status: 400 }
    );
  }

  try {
    const { orderId, paid, failed, expired } = parseXenditWebhook(payload);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
      },
    });

    const providerRef = (payload as any).data?.id || (payload as any).id || "xendit";

    if (!order) {
      return NextResponse.json(createSuccessResponse({ acknowledged: true }));
    }

    if (paid) {
      // Flip to PAID once. Guarded so a retry doesn't re-fire the Inngest event.
      if (order.paymentStatus !== "PAID") {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            status: "CONFIRMED",
          },
        });

        await inngest.send({
          name: "order/payment.confirmed",
          data: {
            orderId,
            storeId: order.storeId,
            providerRef,
          },
        });
      }

      // Payment confirmed — the purchase is complete, so sync stock now.
      // deductStockForOrder is idempotent (guards on an existing SALE movement),
      // so we attempt it even when the order is already PAID. This recovers the
      // case where a previous webhook flipped the order to PAID but its deduction
      // attempt threw before writing any movement: on Xendit's retry we re-run it.
      try {
        await deductStockForOrder(orderId, order.storeId);
      } catch (err) {
        console.error("[XENDIT_WEBHOOK] Stock deduction failed:", err);
        // Signal failure so Xendit retries and the deduction can be re-attempted.
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Stock deduction failed"),
          { status: 500 }
        );
      }

      return NextResponse.json(createSuccessResponse({ acknowledged: true }));
    }

    // Non-paid events: keep the terminal-state idempotency guard.
    if (
      order.paymentStatus === "PAID" ||
      order.paymentStatus === "REFUNDED" ||
      order.paymentStatus === "FAILED" ||
      order.paymentStatus === "EXPIRED"
    ) {
      return NextResponse.json(createSuccessResponse({ acknowledged: true }));
    }

    if (failed) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "FAILED" },
      });

      await inngest.send({
        name: "order/payment.failed",
        data: {
          orderId,
          storeId: order.storeId,
          providerRef,
        },
      });
    } else if (expired) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "EXPIRED" },
      });
    }

    return NextResponse.json(createSuccessResponse({ acknowledged: true }));
  } catch (error: unknown) {
    console.error("[XENDIT_WEBHOOK_ERROR]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message), {
      status: 500,
    });
  }
}
