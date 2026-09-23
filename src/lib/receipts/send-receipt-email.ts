import { prisma } from "@/lib/prisma";
import { sendReceiptEmail } from "@/lib/services/email.service";
import { formatCurrency } from "@/lib/utils/formatting";
import { RECEIPT_INTL_LOCALE, resolveReceiptLocale } from "./receipt-labels";
import { isReceiptSendLimitReached, RECEIPT_SEND_LIMIT_REASON } from "./receipt-send-limit";
import { buildReceiptData, type BuiltReceipt } from "./build-receipt-data";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export type SendReceiptEmailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

interface SendReceiptEmailOptions {
  /** The caller's storeId — this function otherwise takes only an orderId and
   * has no tenant scoping of its own. Same guard as sendCustomerReceiptForOrder. */
  expectedStoreId?: string;
  /** The receipt data when the caller has already built it, so it isn't built (and the order re-read) twice. */
  prebuilt?: BuiltReceipt;
}

/**
 * Email a customer their receipt — the email sibling of
 * `sendCustomerReceiptForOrder` (WhatsApp), and written the same way: one
 * `OrderReceiptSend` row per actual attempt (SENT or FAILED, never on a skip),
 * so the order-history "already sent" state covers both channels from one log.
 *
 * Unlike the phone override, the address IS written back to
 * `Order.customerEmail` — but only when the order has none. `customerEmail`
 * has existed on Order forever and was never populated by the POS; filling it
 * from the first receipt send is how a walk-in gets an address at all, while
 * refusing to overwrite an existing one keeps the storefront's own captured
 * address authoritative.
 */
export async function sendReceiptEmailForOrder(
  orderId: string,
  email: string,
  options: SendReceiptEmailOptions = {}
): Promise<SendReceiptEmailResult> {
  const recipient = email.trim();
  if (!recipient) return { sent: false, skipped: true, reason: "no_recipient_email" };

  const built = options.prebuilt ?? (await buildReceiptData(orderId));
  if (!built) return { sent: false, skipped: true, reason: "order_not_found" };
  if (options.expectedStoreId && built.storeId !== options.expectedStoreId) {
    return { sent: false, skipped: true, reason: "order_not_found" };
  }

  // Shared with the WhatsApp path: the cap is on "send this receipt to
  // someone", counted per order across every channel, so a hundred emails is
  // no more available than a hundred WhatsApp messages.
  if (await isReceiptSendLimitReached(orderId)) {
    return { sent: false, skipped: true, reason: RECEIPT_SEND_LIMIT_REASON };
  }

  const locale = resolveReceiptLocale(built.receipt.locale);
  const currency = built.receipt.currency ?? "IDR";
  // Order money is literal in the store's display currency — formatted, never
  // converted (the recurring bug class this codebase keeps hitting).
  const totalFormatted = formatCurrency(built.receipt.total, currency, RECEIPT_INTL_LOCALE[locale]);

  const result = await sendReceiptEmail({
    to: recipient,
    storeName: built.receipt.storeName,
    orderNumber: built.receipt.orderNumber,
    totalFormatted,
    receiptUrl: `${APP_URL}/r/${orderId}`,
    locale,
  });

  await prisma.orderReceiptSend.create({
    data: {
      orderId,
      channel: "EMAIL",
      // recipientPhone is nullable now precisely so an email send can leave it
      // unset rather than inventing a placeholder number.
      recipientEmail: recipient,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.success ? null : (result.error ?? "Failed to send email"),
    },
  });

  if (!result.success) {
    return { sent: false, skipped: false, error: result.error ?? "Failed to send email" };
  }

  // Best-effort: a successful receipt is worth more than the address capture,
  // so this never fails the send. `updateMany` with the null/empty guard makes
  // it a single conditional statement instead of a read-then-write race.
  await prisma.order
    .updateMany({
      where: { id: orderId, OR: [{ customerEmail: null }, { customerEmail: "" }] },
      data: { customerEmail: recipient },
    })
    .catch(() => undefined);

  return { sent: true };
}

/**
 * The automatic send: fired by the `order/placed` and `order/payment.confirmed`
 * events (see send-receipt-email-on-order.ts) for any order that carries a
 * customer email — one the customer typed on the customer-facing screen, or
 * their Customer record's. The address being on the order IS the consent; there
 * is no store toggle, unlike the WhatsApp auto-send, because nothing here can
 * reach someone who didn't hand over their address.
 *
 * Every skip is silent and writes no log row, so the order-history status only
 * ever reports real attempts:
 *  - `not_paid`: a Pay Later or still-PENDING order gets its receipt when it is
 *    paid, not when it is placed (the paying event fires this again);
 *  - `already_sent`: both events can fire for the same order, and a manual send
 *    from the "order complete" screen may have got there first;
 *  - `email_not_configured`: without a Resend key `sendReceiptEmail` reports a
 *    simulated success, which must not be logged as a delivered receipt.
 */
export async function sendAutoReceiptEmailForOrder(
  orderId: string
): Promise<SendReceiptEmailResult> {
  const built = await buildReceiptData(orderId);
  if (!built) return { sent: false, skipped: true, reason: "order_not_found" };
  if (!built.customerEmail) return { sent: false, skipped: true, reason: "no_customer_email" };
  if (built.paymentStatus !== "PAID") return { sent: false, skipped: true, reason: "not_paid" };
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, skipped: true, reason: "email_not_configured" };
  }

  const alreadySent = await prisma.orderReceiptSend.findFirst({
    where: { orderId, channel: "EMAIL", status: "SENT" },
    select: { id: true },
  });
  if (alreadySent) return { sent: false, skipped: true, reason: "already_sent" };

  return sendReceiptEmailForOrder(orderId, built.customerEmail, { prebuilt: built });
}
