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
    mutationFn: ({ orderId, amount, reason }: { orderId: string; amount: number; reason?: string }) =>
      apiClient.post(`/stores/${storeId}/pos/orders/${orderId}/refund`, { amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
      // Refund changes refundAmount, which every Finance report nets against
      // revenue — see invalidateFinanceQueries' doc comment.
      invalidateFinanceQueries(queryClient);
    },
  });
}
