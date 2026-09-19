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

/** Send-attempt log for one order, most recent first — powers the "already sent" state in order history. */
export function useOrderReceiptSends(storeId: string, orderId: string | undefined) {
  return useQuery<OrderReceiptSendRecord[]>({
    queryKey: ["pos", "order-receipt-sends", storeId, orderId],
    queryFn: async () => {
      const res = await apiClient.get<OrderReceiptSendRecord[]>(
        `/stores/${storeId}/pos/orders/${orderId}/send-receipt`
      );
      return (res as any)?.data ?? res ?? [];
    },
    enabled: !!storeId && !!orderId,
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

/** Email the customer their receipt — same send log, different channel. */
export function useSendOrderReceiptEmail(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, email }: { orderId: string } & SendReceiptEmailBody) =>
      apiClient.post(`/stores/${storeId}/pos/orders/${orderId}/send-receipt-email`, { email }),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pos", "order-receipt-sends", storeId, orderId],
      });
    },
  });
}
