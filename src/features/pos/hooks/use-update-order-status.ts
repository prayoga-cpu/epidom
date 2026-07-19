import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/**
 * Shared order-status mutation used by both the Active Queue (confirm / start
 * process / complete / cancel) and Order History's cancel action, so the
 * PATCH call + cache invalidation only lives in one place.
 */
export function useUpdateOrderStatus(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      apiClient.patch(`/stores/${storeId}/pos/orders/${orderId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
    },
  });
}
