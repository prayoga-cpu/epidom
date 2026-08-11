"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StockMovement } from "@prisma/client";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

export interface StockMovementWithRelations extends StockMovement {
  // reason and referenceId are already in StockMovement from Prisma
  material?: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
  } | null;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
  } | null;
  productionBatch?: {
    id: string;
    batchNumber: string;
  } | null;
  order?: {
    id: string;
    orderNumber: string;
  } | null;
}

export interface StockMovementsResponse {
  movements: StockMovementWithRelations[];
  total: number;
}

export interface StockMovementFilters {
  materialId?: string;
  productId?: string;
  itemType?: "material" | "product";
  dateFrom?: string;
  dateTo?: string;
  type?: string;
}

// Query keys
export const stockMovementKeys = {
  all: (storeId: string) => ["stock-movements", storeId] as const,
  lists: (storeId: string) => [...stockMovementKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: StockMovementFilters) =>
    [...stockMovementKeys.lists(storeId), filters] as const,
};

/**
 * Fetch stock movements for an item
 * Real-time enabled: Polls every 30 seconds when tab is active
 */
export function useStockMovements(storeId: string, filters?: StockMovementFilters) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);
  const queryClient = useQueryClient();

  useRealtimeChannel(storeId, {
    [REALTIME_EVENTS.STOCK_CHANGED]: () => {
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.lists(storeId) });
    },
  });

  return useQuery<StockMovementsResponse>({
    queryKey: stockMovementKeys.list(storeId, normalizedFilters),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (normalizedFilters) {
        Object.entries(normalizedFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = `/api/stores/${storeId}/stock-movements${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch stock movements");
      }

      return response.json();
    },
    enabled: !!storeId && !!(filters?.materialId || filters?.productId),
    // Real-time configuration: Pusher (see useRealtimeChannel above,
    // STOCK_CHANGED) is the primary update path; this poll is only a safety
    // net for when push misses an event, so it doesn't need safety-net-grade
    // CPU cost. Kept tighter than other hooks since stock is critical data.
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000, // Safety-net poll — Pusher covers the instant case
    refetchIntervalInBackground: false, // Only poll when tab is active
    // See use-materials.ts — `false` suppressed the refetch even for a query a
    // mutation had just invalidated, so the movements ledger could disagree
    // with the stock figure it is supposed to explain.
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch on window focus if stale
    meta: {
      refetchInterval: 15 * 1000, // Store in meta for smart polling
    },
  });
}
