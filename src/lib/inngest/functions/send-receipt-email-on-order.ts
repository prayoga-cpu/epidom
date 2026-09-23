import { inngest } from "../client";
import { sendAutoReceiptEmailForOrder } from "@/lib/receipts/send-receipt-email";

/**
 * Auto-sends the emailed receipt when the customer left an address — typed on
 * the customer-facing screen, or on their Customer record.
 *
 * Same two triggers as the WhatsApp job (send-customer-receipt.ts) and for the
 * same reason: `order/placed` covers a POS order paid at creation and a Pay
 * Later order paid afterwards (finalize re-emits it), `order/payment.confirmed`
 * covers QRIS / e-wallet orders that start PENDING. The order is re-read by id
 * rather than trusting either payload, and the send is idempotent (skips once an
 * EMAIL row is SENT), so both events firing for one order is safe.
 *
 * A failed send is returned, not thrown: the failure is already recorded on the
 * order's send log for the cashier to see and retry, and rethrowing would make
 * Inngest replay it, burning the per-order send allowance on repeat failures.
 */
export const sendReceiptEmailOnOrder = inngest.createFunction(
  {
    id: "send-receipt-email",
    retries: 3,
    triggers: [{ event: "order/placed" }, { event: "order/payment.confirmed" }],
  },
  async ({ event }) => {
    const orderId: string | undefined = event.data?.orderId;
    if (!orderId) return { skipped: true, reason: "no_order_id" };

    const result = await sendAutoReceiptEmailForOrder(orderId);
    return { orderId, ...result };
  }
);
