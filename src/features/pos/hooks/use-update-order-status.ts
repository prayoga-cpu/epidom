import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/**
 * Shared order-status mutation used by the Active Queue (confirm / start
 * process / complete / cancel), Order History's cancel + mark-paid actions,
 * and the Alerts page's mark-paid action, so the PATCH call + cache
 * invalidation only lives in one place. `status` and `paymentStatus` are
 * independent — pass either or both.
 */
export function useUpdateOrderStatus(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      status,
      paymentStatus,
    }: {
      orderId: string;
      status?: string;
      paymentStatus?: "PAID";
    }) => apiClient.patch(`/stores/${storeId}/pos/orders/${orderId}`, { status, paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alerts", "list", storeId] });
    },
  });
}
