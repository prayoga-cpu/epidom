"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateIngredientInput,
  UpdateIngredientInput,
  MaterialFilterInput,
  BulkDeleteInput,
} from "@/lib/validation/inventory.schemas";
import { ApiSuccessResponse } from "@/types/api/responses";
import { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import { supplierKeys } from "../../suppliers/hooks/use-suppliers";
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { invalidateMaterialRelatedQueries } from "@/lib/react-query/cache-utils";
import { DEFAULT_QUERY_OPTIONS } from "@/lib/react-query/constants";
import { buildQueryParams } from "@/lib/utils/query-params";
import { fetchWithErrorHandling } from "@/lib/api/client";
import { exportToCSV } from "@/lib/utils/export";

export interface MaterialsResponse {
  materials: MaterialWithSuppliers[];
  total: number;
}

// Query keys for cache management (DRY principle)
export const materialKeys = {
  all: (storeId: string) => ["materials", storeId] as const,
  lists: (storeId: string) => [...materialKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: MaterialFilterInput) =>
    [...materialKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...materialKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...materialKeys.details(storeId), id] as const,
};

/**
 * Fetch all materials for a store with optional filtering
 */
export function useMaterials(storeId: string, filters?: MaterialFilterInput) {
  return useQuery<MaterialsResponse>({
    queryKey: materialKeys.list(storeId, filters),
    queryFn: async () => {
      const params = buildQueryParams(filters || {});
      const url = `/api/stores/${storeId}/materials${params.toString() ? `?${params.toString()}` : ""}`;
      return fetchWithErrorHandling<MaterialsResponse>(url);
    },
    enabled: !!storeId,
    ...DEFAULT_QUERY_OPTIONS.inventory,
  });
}

/**
 * Fetch a single material by ID
 */
export function useMaterial(storeId: string, id: string) {
  return useQuery<MaterialWithSuppliers>({
    queryKey: materialKeys.detail(storeId, id),
    queryFn: () => fetchWithErrorHandling<MaterialWithSuppliers>(`/api/stores/${storeId}/materials/${id}`),
    enabled: !!storeId && !!id,
    ...DEFAULT_QUERY_OPTIONS.inventory,
  });
}

/**
 * Create a new material with optimistic updates
 */
export function useCreateMaterial(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<MaterialWithSuppliers, Error, Omit<CreateIngredientInput, "storeId">>({
    mutationFn: (input) =>
      fetchWithErrorHandling<MaterialWithSuppliers>(`/api/stores/${storeId}/materials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      // Batch invalidate all related queries in parallel for better performance
      await invalidateMaterialRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Update an existing material with cache invalidation
 */
export function useUpdateMaterial(storeId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation<MaterialWithSuppliers, Error, UpdateIngredientInput>({
    mutationFn: (input) =>
      fetchWithErrorHandling<MaterialWithSuppliers>(`/api/stores/${storeId}/materials/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: async (updatedMaterial) => {
      // Update cache for specific material (optimistic update)
      queryClient.setQueryData(materialKeys.detail(storeId, id), updatedMaterial);
      // Batch invalidate all related queries in parallel for better performance
      await invalidateMaterialRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Delete a material with cache invalidation
 */
export function useDeleteMaterial(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) =>
      fetchWithErrorHandling<{ message: string }>(`/api/stores/${storeId}/materials/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, deletedId) });
      // Batch invalidate all related queries in parallel for better performance
      await invalidateMaterialRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Bulk delete materials with cache invalidation
 */
export function useBulkDeleteMaterials(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string; deletedCount: number }, Error, BulkDeleteInput>({
    mutationFn: (input) =>
      fetchWithErrorHandling<{ message: string; deletedCount: number }>(
        `/api/stores/${storeId}/materials/bulk`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }
      ),
    onSuccess: async (_, { ids }) => {
      // Remove all deleted items from cache
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, id) });
      });
      // Batch invalidate all related queries in parallel for better performance
      await invalidateMaterialRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Export materials to CSV
 */
export function useExportMaterials(storeId: string) {
  return useMutation<void, Error, MaterialFilterInput | undefined>({
    mutationFn: (filters) =>
      exportToCSV(`/api/stores/${storeId}/materials/export`, "export", "materials", filters),
  });
}
