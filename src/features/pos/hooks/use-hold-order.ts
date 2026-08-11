import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CartItem } from "../types/pos.types";

export interface HoldOrderInput {
  items: CartItem[];
  orderType: "DINE_IN" | "TAKEAWAY";
  /** Pax, DINE_IN only — carried through to finalize so a held dine-in order
   * keeps the guest count the cashier already entered. */
  guestCount?: number;
  tableId?: string;
  tableNumber?: string;
  customerName?: string;
  notes?: string;
  shiftId?: string;
  /** Set when re-holding an already-held order in place, instead of creating a duplicate. */
  orderId?: string;
}

/**
 * Park the current cart aside as a HELD order (or update one in place, if
 * `orderId` is passed — resume, edit, hold again). Mirrors
 * useUpdateOrderStatus's cache-invalidation shape.
 */
export function useHoldOrder(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: HoldOrderInput) =>
      apiClient.post(`/stores/${storeId}/pos/orders/hold`, {
        items: input.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          selectedOptions: i.modifiers,
          notes: i.notes,
        })),
        orderType: input.orderType,
        guestCount: input.guestCount,
        tableId: input.tableId,
        tableNumber: input.tableNumber,
        customerName: input.customerName,
        notes: input.notes,
        shiftId: input.shiftId,
        orderId: input.orderId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
    },
  });
}
