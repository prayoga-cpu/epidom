import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { invalidateFinanceQueries } from "@/lib/utils/cache-helpers";

/**
 * Staff-initiated refund (POS order history "Issue Refund" action). Same
 * invalidation targets as useUpdateOrderStatus, since a refund also changes
 * paymentStatus for a full refund.
 */
export function useRefundOrder(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      amount,
      reason,
      // Which OrderPayment hands the money back, on a bill settled with more
      // than one tender. Omitted for a single-tender or legacy order, where
      // there is nothing to choose.
      tenderId,
    }: {
      orderId: string;
      amount: number;
      reason?: string;
      tenderId?: string;
    }) =>
      apiClient.post(`/stores/${storeId}/pos/orders/${orderId}/refund`, {
        amount,
        reason,
        tenderId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
      // Refund changes refundAmount, which every Finance report nets against
      // revenue — see invalidateFinanceQueries' doc comment.
      invalidateFinanceQueries(queryClient);
    },
  });
}
