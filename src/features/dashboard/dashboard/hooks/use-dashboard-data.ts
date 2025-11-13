"use client";

import { useQueries } from "@tanstack/react-query";
import { materialKeys, type MaterialsResponse } from "@/features/dashboard/data/materials/hooks/use-materials";
import { supplierKeys, type SuppliersResponse } from "@/features/dashboard/data/suppliers/hooks/use-suppliers";
import { productionBatchKeys, type ProductionBatchesResponse } from "@/features/dashboard/management/recipe-production/hooks/use-production-batches";
import type { MaterialFilterInput } from "@/lib/validation/inventory.schemas";
import type { SupplierFilterInput } from "@/features/dashboard/data/suppliers/hooks/use-suppliers";
import type { ProductionBatchFilterInput } from "@/lib/validation/production.schemas";
import type { ApiSuccessResponse } from "@/types/api/responses";

/**
 * Dashboard Data Hook
 *
 * Batches all dashboard API calls to prevent waterfall requests.
 * All queries run in parallel for better performance.
 *
 * Uses consistent query keys via factories to ensure proper cache sharing
 * with individual hooks (useMaterials, useSuppliers, useProductionBatches).
 *
 * @param storeId - Store ID
 * @returns Combined data, loading states, and errors for all dashboard cards
 */
export function useDashboardData(storeId: string | null) {
  // Dashboard-specific filters
  const materialFilters: MaterialFilterInput | undefined = undefined; // No filters for dashboard
  const supplierFilters: SupplierFilterInput = { sortBy: "name", sortOrder: "asc" };
  const productionBatchFilters: ProductionBatchFilterInput = {
    sortBy: "scheduledDate",
    sortOrder: "desc",
    skip: 0,
    take: 10,
  };

  // Use useQueries to batch all queries in parallel
  // Use query key factories to ensure cache sharing with individual hooks
  const queries = useQueries({
    queries: [
      // Materials query (used by AlertsCard and TrackingCard)
      // Uses materialKeys.list() for consistent cache sharing
      {
        queryKey: materialKeys.list(storeId!, materialFilters),
        queryFn: async () => {
          if (!storeId) return null;
          const response = await fetch(`/api/stores/${storeId}/materials`);
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Failed to fetch materials");
          }
          const data = await response.json();
          return data.data as MaterialsResponse;
        },
        enabled: !!storeId,
        staleTime: 60 * 1000, // 1 minute
      },
      // Suppliers query (used by SupplierCard)
      // Uses supplierKeys.list() for consistent cache sharing
      {
        queryKey: supplierKeys.list(storeId!, supplierFilters),
        queryFn: async () => {
          if (!storeId) return null;
          const params = new URLSearchParams();
          if (supplierFilters.sortBy) params.append("sortBy", supplierFilters.sortBy);
          if (supplierFilters.sortOrder) params.append("sortOrder", supplierFilters.sortOrder);
          const response = await fetch(`/api/stores/${storeId}/suppliers?${params.toString()}`);
          if (!response.ok) {
            const errorData = await response.json();
            // Handle subscription locked error
            if (response.status === 403 && errorData.error?.code === "SUBSCRIPTION_FEATURE_LOCKED") {
              const customError = new Error(
                errorData.error?.message || "Supplier Management is only available in Pro and Enterprise plans"
              );
              (customError as any).code = "SUBSCRIPTION_FEATURE_LOCKED";
              (customError as any).status = 403;
              (customError as any).upgradeRequired = true;
              throw customError;
            }
            throw new Error(errorData.error?.message || "Failed to fetch suppliers");
          }
          const data: ApiSuccessResponse<SuppliersResponse> = await response.json();
          return data.data;
        },
        enabled: !!storeId,
        staleTime: 60 * 1000, // 1 minute
      },
      // Production batches query (used by ProductionHistoryChart)
      // Uses productionBatchKeys.list() for consistent cache sharing
      {
        queryKey: productionBatchKeys.list(storeId!, productionBatchFilters),
        queryFn: async () => {
          if (!storeId) return null;
          const params = new URLSearchParams();
          if (productionBatchFilters.sortBy) params.append("sortBy", productionBatchFilters.sortBy);
          if (productionBatchFilters.sortOrder) params.append("sortOrder", productionBatchFilters.sortOrder);
          if (productionBatchFilters.skip !== undefined) params.append("skip", productionBatchFilters.skip.toString());
          if (productionBatchFilters.take !== undefined) params.append("take", productionBatchFilters.take.toString());
          const response = await fetch(
            `/api/stores/${storeId}/production-batches?${params.toString()}`
          );
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Failed to fetch production batches");
          }
          const data: ApiSuccessResponse<ProductionBatchesResponse> = await response.json();
          return data.data;
        },
        enabled: !!storeId,
        staleTime: 60 * 1000, // 1 minute
      },
    ],
  });

  // Extract individual query results
  const [materialsQuery, suppliersQuery, productionBatchesQuery] = queries;

  return {
    // Data
    materials: materialsQuery.data,
    suppliers: suppliersQuery.data,
    productionBatches: productionBatchesQuery.data,

    // Loading states
    isLoadingMaterials: materialsQuery.isLoading,
    isLoadingSuppliers: suppliersQuery.isLoading,
    isLoadingProductionBatches: productionBatchesQuery.isLoading,
    isLoading: materialsQuery.isLoading || suppliersQuery.isLoading || productionBatchesQuery.isLoading,

    // Error states
    materialsError: materialsQuery.error,
    suppliersError: suppliersQuery.error,
    productionBatchesError: productionBatchesQuery.error,
    hasError: !!materialsQuery.error || !!suppliersQuery.error || !!productionBatchesQuery.error,

    // Individual query refetch functions (if needed)
    refetchMaterials: materialsQuery.refetch,
    refetchSuppliers: suppliersQuery.refetch,
    refetchProductionBatches: productionBatchesQuery.refetch,
  };
}

