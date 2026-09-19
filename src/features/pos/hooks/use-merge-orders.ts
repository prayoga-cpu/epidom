import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { MergeOrdersBody, MergeOrdersResultDto } from "@/types/api/cashier";

/**
 * Merge saved (HELD) bills into one. HELD ↔ HELD only: the sources become
 * CANCELLED ("Merged into #X") and their discounts are dropped, so the
 * invalidation below refreshes the queue, which now lacks them.
 */
export function useMergeOrders(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MergeOrdersBody) =>
      apiClient.post<MergeOrdersResultDto>(`/stores/${storeId}/pos/orders/merge`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
    },
  });
}
