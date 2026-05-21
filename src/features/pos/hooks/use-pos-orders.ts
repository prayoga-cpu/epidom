import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PosOrderDisplay, OrdersSSEMessage } from "../types/pos.types";
import { apiClient } from "@/lib/api/client";

export function usePosOrders(storeId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pos", "orders", storeId],
    queryFn: async () => {
      return apiClient.get<PosOrderDisplay[]>(`/stores/${storeId}/pos/orders`);
    },
    enabled: !!storeId,
    refetchInterval: 10000, // Fallback polling every 10s in case SSE fails
  });

  // Setup SSE for real-time updates (best-effort, graceful degradation)
  useEffect(() => {
    if (!storeId) return;

    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    let isMounted = true;
    const MAX_RECONNECT_DELAY = 30000;
    const INITIAL_RECONNECT_DELAY = 2000;

    const connect = () => {
      if (!isMounted) return;

      try {
        if (eventSource) {
          eventSource.close();
        }

        eventSource = new EventSource(`/api/stores/${storeId}/orders/stream`);

        eventSource.onopen = () => {
          reconnectAttempts = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "orders") {
              const message = data as OrdersSSEMessage;
              queryClient.setQueryData(["pos", "orders", storeId], message.orders);
            }
          } catch {
            // Silently ignore parse errors from keep-alive or malformed data
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          if (!isMounted) return;

          // Exponential backoff for reconnection
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
            MAX_RECONNECT_DELAY
          );
          reconnectAttempts++;

          retryTimeout = setTimeout(connect, delay);
        };
      } catch {
        // EventSource constructor can throw in some environments
        // Fall back to polling (refetchInterval above handles this)
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(retryTimeout);
    };
  }, [storeId, queryClient]);

  return query;
}
