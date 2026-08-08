import { inngest } from "../client";
import { sendCustomerReceiptForOrder } from "@/lib/receipts/send-customer-receipt";

/**
 * Auto-sends the customer-facing WhatsApp receipt link. Triggered on both
 * order/placed (covers cash-paid-at-creation POS orders) and
 * order/payment.confirmed (covers QRIS/e-wallet orders that start PENDING
 * and only become PAID once Xendit confirms) — it re-fetches the order
 * fresh by orderId rather than trusting either event's payload, since
 * neither carries every field this needs (customerPhone, paymentStatus,
 * the store's auto-send toggle). sendCustomerReceiptForOrder is itself
 * idempotent (skips if already SENT), so being triggered by both events for
 * the same order is safe.
 */
export const sendCustomerReceiptOnOrder = inngest.createFunction(
  {
    id: "send-customer-receipt",
    retries: 3,
    triggers: [{ event: "order/placed" }, { event: "order/payment.confirmed" }],
  },
  async ({ event }) => {
    const orderId: string | undefined = event.data?.orderId;
    if (!orderId) return { skipped: true, reason: "no_order_id" };

    const result = await sendCustomerReceiptForOrder(orderId);
    return { orderId, ...result };
  }
);
