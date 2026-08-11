"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { PosOrderDisplay } from "../types/pos.types";

/**
 * PATCHes every not-yet-ready item on an order to READY in one shot — the
 * Order Queue equivalent of the KDS's "Mark All Complete", for stores that
 * don't want a cashier switching to Kitchen & Bar just to advance a simple
 * order. Item-level PATCHes (not a direct order.status write) so the same
 * server-side advanceOrderToReadyIfAllItemsReady invariant KDS relies on
 * stays the single source of truth for when an order actually reaches READY.
 */
export function useMarkOrderReady(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: PosOrderDisplay) => {
      const pendingIds = order.items
        .filter((i) => i.status !== "READY" && i.status !== "SERVED" && i.status !== "CANCELLED")
        .map((i) => i.id);

      await Promise.all(
        pendingIds.map((itemId) =>
          apiClient.patch(`/stores/${storeId}/pos/orders/${order.id}/items/${itemId}`, {
            status: "READY",
          })
        )
      );
    },
    // Both branches invalidate rather than patch the cache optimistically —
    // Promise.all can partially succeed on a rejection, so a plain refetch is
    // the only way to stay correct without re-deriving item-level state here.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
    },
  });
}
