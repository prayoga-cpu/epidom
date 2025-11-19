"use client";

import { useQuery } from "@tanstack/react-query";
import { StockMovement } from "@prisma/client";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";

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
    // Real-time configuration: Active data polling
    staleTime: 20 * 1000, // 20 seconds
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Only poll when tab is active
    refetchOnMount: false, // Don't refetch if data is fresh (within staleTime)
    refetchOnWindowFocus: true, // Refetch on window focus if stale
    meta: {
      refetchInterval: 30 * 1000, // Store in meta for smart polling
    },
  });
}
