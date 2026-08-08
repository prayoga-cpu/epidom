import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface OrderReceiptSendRecord {
  id: string;
  channel: string;
  recipientPhone: string;
  status: "SENT" | "FAILED";
  fonnteMessageId: string | null;
  errorMessage: string | null;
  sentAt: string;
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

/** Manual "Send/Resend receipt via WhatsApp" — bypasses the store's auto-send toggle. */
export function useSendOrderReceipt(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) =>
      apiClient.post(`/stores/${storeId}/pos/orders/${orderId}/send-receipt`, {}),
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({
        queryKey: ["pos", "order-receipt-sends", storeId, orderId],
      });
    },
  });
}
