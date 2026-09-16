import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { invalidateFinanceQueries } from "@/lib/utils/cache-helpers";
import type { SettlePaymentMethod } from "../types/pos.types";

/**
 * Shared order-status mutation used by the Active Queue (confirm / start
 * process / complete / cancel), Order History's cancel + mark-paid actions,
 * and the Alerts page's mark-paid action, so the PATCH call + cache
 * invalidation only lives in one place. `status` and `paymentStatus` are
 * independent — pass either or both. `paymentMethod`/`paymentNote` are only
 * meaningful alongside `paymentStatus: "PAID"`.
 */
export function useUpdateOrderStatus(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      status,
      paymentStatus,
      paymentMethod,
      paymentNote,
    }: {
      orderId: string;
      status?: string;
      paymentStatus?: "PAID";
      paymentMethod?: SettlePaymentMethod;
      paymentNote?: string;
    }) =>
      apiClient.patch(`/stores/${storeId}/pos/orders/${orderId}`, {
        status,
        paymentStatus,
        paymentMethod,
        paymentNote,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alerts", "list", storeId] });
      // A status change (cancel, mark-paid) moves an order in/out of revenue —
      // without this, the Finance page and dashboard analytics keep showing
      // whatever they'd already cached for up to their 30s staleTime, so
      // cancelling an order can look like it "didn't change the numbers" for
      // however long is left of that window.
      invalidateFinanceQueries(queryClient);
    },
  });
}
