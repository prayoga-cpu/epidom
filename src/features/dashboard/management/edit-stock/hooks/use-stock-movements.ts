"use client";

import { useQuery } from "@tanstack/react-query";
import { StockMovement } from "@prisma/client";

export interface StockMovementWithRelations extends StockMovement {
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
 */
export function useStockMovements(storeId: string, filters?: StockMovementFilters) {
  return useQuery<StockMovementsResponse>({
    queryKey: stockMovementKeys.list(storeId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
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
  });
}
