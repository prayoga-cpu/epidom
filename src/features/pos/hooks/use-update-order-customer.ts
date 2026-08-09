import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/** Persists a customer phone captured after the fact (e.g. typed in to
 * unlock "Send via WhatsApp" on an order that had none on file). */
export function useUpdateOrderCustomerPhone(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, customerPhone }: { orderId: string; customerPhone: string }) =>
      apiClient.patch(`/stores/${storeId}/pos/orders/${orderId}/customer`, { customerPhone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
    },
  });
}
