import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { SendReceiptBody, SendReceiptEmailBody } from "@/types/api/cashier";

export interface OrderReceiptSendRecord {
  id: string;
  /** "WHATSAPP" | "EMAIL" — a plain string on the row, not an enum. */
  channel: string;
  /**
   * Exactly one of these is set, per channel. Both are nullable since email
   * receipts landed: a WhatsApp send has no address and an email send has no
   * number, and inventing a placeholder for the missing one would put a fake
   * recipient in the send log.
   */
  recipientPhone: string | null;
  recipientEmail: string | null;
  status: "SENT" | "FAILED";
  fonnteMessageId: string | null;
  errorMessage: string | null;
  sentAt: string;
}

/** Whoever this attempt actually went to, whichever channel it used. */
export function receiptSendRecipient(send: OrderReceiptSendRecord): string | null {
  return send.recipientEmail ?? send.recipientPhone ?? null;
}

/** How often to re-read the send log while an automatic receipt email is still on its way. */
export const RECEIPT_EMAIL_POLL_MS = 2_000;

/**
 * Where the emailed receipt stands, read off an order's send log.
 *
 * A successful send wins over everything after it: a failed RESEND on top of a
 * delivered receipt doesn't un-deliver it, and reporting "failed" would send the
 * cashier chasing a problem the customer doesn't have. With no success, the most
 * recent failure is what's shown; with no attempt at all it is simply not sent yet.
 */
export type EmailReceiptStatus =
  | { state: "sent"; recipient: string | null; at: string }
  | { state: "failed"; recipient: string | null; at: string; error: string | null }
  | { state: "not_sent" };

export function deriveEmailReceiptStatus(
  sends: OrderReceiptSendRecord[] | undefined
): EmailReceiptStatus {
  // The log is most-recent-first, so `find` is "the latest such row".
  const emails = (sends ?? []).filter((send) => send.channel === "EMAIL");
  const sent = emails.find((send) => send.status === "SENT");
  if (sent) return { state: "sent", recipient: sent.recipientEmail, at: sent.sentAt };
  const latest = emails[0];
  if (latest) {
    return {
      state: "failed",
      recipient: latest.recipientEmail,
      at: latest.sentAt,
      error: latest.errorMessage,
    };
  }
  return { state: "not_sent" };
}

/**
 * Send-attempt log for one order, most recent first — powers the "already sent"
 * state in order history and the emailed-receipt status on the POS complete screen.
 *
 * `pollForEmail`: an automatic receipt email is expected (the order carries an
 * address and is paid), and it is sent by a background job a moment AFTER the
 * order is created — so keep re-reading the log until an EMAIL row appears,
 * rather than showing "not sent" for a receipt that is seconds from going out.
 * The caller turns it off once it has waited long enough.
 */
export function useOrderReceiptSends(
  storeId: string,
  orderId: string | undefined,
  options: { pollForEmail?: boolean } = {}
) {
  return useQuery<OrderReceiptSendRecord[]>({
    queryKey: ["pos", "order-receipt-sends", storeId, orderId],
    queryFn: async () => {
      const res = await apiClient.get<OrderReceiptSendRecord[]>(
        `/stores/${storeId}/pos/orders/${orderId}/send-receipt`
      );
      return (res as any)?.data ?? res ?? [];
    },
    enabled: !!storeId && !!orderId,
    refetchInterval: (query) =>
      options.pollForEmail && !query.state.data?.some((send) => send.channel === "EMAIL")
        ? RECEIPT_EMAIL_POLL_MS
        : false,
  });
}

/**
 * Manual "Send/Resend receipt via WhatsApp" — bypasses the store's auto-send
 * toggle. `phone` overrides `Order.customerPhone` for this send only (the POS
 * complete screen lets the cashier type a number after the sale); omit it and
 * the order's own number is used, exactly as before.
 */
export function useSendOrderReceipt(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, phone }: { orderId: string } & SendReceiptBody) =>
      apiClient.post(
        `/stores/${storeId}/pos/orders/${orderId}/send-receipt`,
        phone ? { phone } : {}
      ),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pos", "order-receipt-sends", storeId, orderId],
      });
    },
  });
}

/**
 * Email the customer their receipt — same send log, different channel.
 *
 * Re-reads the log when the send settles, not only when it succeeds: a mail
 * provider error is a 503 to the caller but still writes a FAILED row, and that
 * row is what the "email failed" status is drawn from.
 */
export function useSendOrderReceiptEmail(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, email }: { orderId: string } & SendReceiptEmailBody) =>
      apiClient.post(`/stores/${storeId}/pos/orders/${orderId}/send-receipt-email`, { email }),
    onSettled: (_data, _error, { orderId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pos", "order-receipt-sends", storeId, orderId],
      });
    },
  });
}
