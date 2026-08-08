import { prisma } from "@/lib/prisma";
import { isFonnteAvailable } from "@/lib/notifications/providers/fonnte";
import { notifyCustomerReceipt } from "@/lib/notifications";
import { buildReceiptData } from "./build-receipt-data";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export type SendCustomerReceiptResult =
  | { sent: true; fonnteMessageId: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

interface SendCustomerReceiptOptions {
  /** Manual "Send/Resend" action bypasses the store's auto-send toggle. */
  skipAutoSendGate?: boolean;
  /** Manual "Resend" explicitly wants a new attempt even if one already succeeded. */
  skipAlreadySentGuard?: boolean;
  /** The manual API route passes the authenticated caller's storeId here so
   * an order belonging to a different store can never be targeted — this
   * function otherwise only takes an orderId, with no tenant scoping. */
  expectedStoreId?: string;
}

/**
 * Shared core behind both trigger surfaces for the customer WhatsApp
 * receipt: the automatic Inngest job (send-customer-receipt.ts function,
 * fired on order/placed + order/payment.confirmed) and the manual
 * "Send/Resend" action in order history. Always writes an OrderReceiptSend
 * row on an actual send attempt (SENT or FAILED) — never on a skip, since a
 * skip isn't an attempt.
 */
export async function sendCustomerReceiptForOrder(
  orderId: string,
  options: SendCustomerReceiptOptions = {}
): Promise<SendCustomerReceiptResult> {
  const built = await buildReceiptData(orderId);
  if (!built) return { sent: false, skipped: true, reason: "order_not_found" };
  if (options.expectedStoreId && built.storeId !== options.expectedStoreId) {
    return { sent: false, skipped: true, reason: "order_not_found" };
  }
  if (!built.customerPhone) return { sent: false, skipped: true, reason: "no_customer_phone" };
  if (built.paymentStatus !== "PAID") return { sent: false, skipped: true, reason: "not_paid" };
  if (!isFonnteAvailable())
    return { sent: false, skipped: true, reason: "fonnte_not_configured" };
  if (!options.skipAutoSendGate && !built.autoSendWhatsappReceipt) {
    return { sent: false, skipped: true, reason: "auto_send_disabled" };
  }

  if (!options.skipAlreadySentGuard) {
    const alreadySent = await prisma.orderReceiptSend.findFirst({
      where: { orderId, channel: "WHATSAPP", status: "SENT" },
      select: { id: true },
    });
    if (alreadySent) return { sent: false, skipped: true, reason: "already_sent" };
  }

  const receiptUrl = `${APP_URL}/r/${orderId}`;

  try {
    const { fonnteMessageId } = await notifyCustomerReceipt({
      customerName: built.customerName,
      storeName: built.receipt.storeName,
      totalAmount: built.receipt.total,
      currency: "IDR",
      orderDate: built.receipt.date,
      receiptUrl,
      customerPhone: built.customerPhone,
    });

    await prisma.orderReceiptSend.create({
      data: {
        orderId,
        channel: "WHATSAPP",
        recipientPhone: built.customerPhone,
        status: "SENT",
        fonnteMessageId,
      },
    });

    return { sent: true, fonnteMessageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send via WhatsApp";
    await prisma.orderReceiptSend.create({
      data: {
        orderId,
        channel: "WHATSAPP",
        recipientPhone: built.customerPhone,
        status: "FAILED",
        errorMessage,
      },
    });
    return { sent: false, skipped: false, error: errorMessage };
  }
}
