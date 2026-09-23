import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { PosOrderDisplay } from "../types/pos.types";

/**
 * The Active Queue, read from the SAME cache entry usePosOrders keeps live —
 * but with none of its side effects.
 *
 * usePosOrders also opens a realtime channel and, without Pusher, its own SSE
 * EventSource (a server-side DB poll per connection). PosShell already mounts
 * one; the cart's header badge, its Print Bill lookup and the Merge Bill list
 * each calling it again would open three more streams against a browser cap of
 * ~6 per origin. They only need the data, and PosShell's instance keeps the
 * cache fresh, so this shares its query key and queryFn (so it can still fetch
 * if the cache is empty) and adds nothing else.
 */
export function usePosOrdersSnapshot(storeId: string) {
  return useQuery({
    queryKey: ["pos", "orders", storeId],
    queryFn: () => apiClient.get<PosOrderDisplay[]>(`/stores/${storeId}/pos/orders`),
    enabled: !!storeId,
    staleTime: 5 * 1000,
  });
}
