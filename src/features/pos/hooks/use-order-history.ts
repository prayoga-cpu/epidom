import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { OrderHistoryFilters, OrderHistoryPage } from "../types/pos.types";
import { apiClient } from "@/lib/api/client";

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export function buildOrderHistoryParams(
  filters: OrderHistoryFilters,
  take: number,
  cursor?: string | null
): URLSearchParams {
  const params = new URLSearchParams({ take: String(take) });
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.source && filters.source !== "ALL") params.set("source", filters.source);
  if (filters.from) params.set("from", `${filters.from}T00:00:00Z`);
  if (filters.to) params.set("to", `${filters.to}T23:59:59Z`);
  if (cursor) params.set("cursor", cursor);
  return params;
}

export function useOrderHistory(storeId: string, filters: OrderHistoryFilters) {
  return useInfiniteQuery({
    queryKey: ["pos", "order-history", storeId, filters],
    queryFn: async ({ pageParam }) => {
      const params = buildOrderHistoryParams(filters, 25, pageParam);
      return apiClient.get<OrderHistoryPage>(`/stores/${storeId}/orders?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!storeId,
  });
}
