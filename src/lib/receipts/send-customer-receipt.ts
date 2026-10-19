import { normalizePhone, callingCodeForCurrency } from "@/lib/utils/phone";
import { isReceiptSendLimitReached, RECEIPT_SEND_LIMIT_REASON } from "./receipt-send-limit";
import { buildReceiptData } from "./build-receipt-data";

export type SendCustomerReceiptResult =
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

interface SendCustomerReceiptOptions {
  /** Manual "Send/Resend" action bypasses the store's auto-send toggle. */
  skipAutoSendGate?: boolean;
  /** Manual "Resend" explicitly wants a new attempt even if one already succeeded. */
  skipAlreadySentGuard?: boolean;
  /** The manual API route passes the authenticated caller's storeId here so
   * an order belonging to a different store can never be targeted. */
  expectedStoreId?: string;
  /**
   * Send to this number instead of `Order.customerPhone`, for the POS
   * "send the receipt to…" field. Deliberately NOT written back to the order.
   */
  phoneOverride?: string | null;
}

/**
 * Validates the order, phone and send-limit before attempting a WhatsApp
 * receipt send. Currently always returns `whatsapp_not_configured` because
 * the Fonnte integration has been removed — the wa.me button in
 * send-receipt-whatsapp.tsx remains the supported zero-config path.
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

  const override = options.phoneOverride?.trim();
  let recipientPhone: string | null;
  if (override) {
    recipientPhone = normalizePhone(override, {
      defaultCallingCode: callingCodeForCurrency(built.receipt.currency),
    });
    if (!recipientPhone) return { sent: false, skipped: true, reason: "invalid_phone" };
  } else {
    recipientPhone = built.customerPhone;
  }
  if (!recipientPhone) return { sent: false, skipped: true, reason: "no_customer_phone" };

  if (await isReceiptSendLimitReached(orderId)) {
    return { sent: false, skipped: true, reason: RECEIPT_SEND_LIMIT_REASON };
  }
  if (built.paymentStatus !== "PAID") return { sent: false, skipped: true, reason: "not_paid" };

  return { sent: false, skipped: true, reason: "whatsapp_not_configured" };
}
