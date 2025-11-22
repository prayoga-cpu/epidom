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
import { invalidateMaterialRelatedQueries } from "@/lib/utils/cache-helpers";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";

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
 * Real-time enabled: Polls every 30 seconds when tab is active
 */
export function useMaterials(storeId: string, filters?: MaterialFilterInput) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  return useQuery<MaterialsResponse>({
    queryKey: materialKeys.list(storeId, normalizedFilters),
    queryFn: async () => {
      // Build query string
      const params = new URLSearchParams();
      if (normalizedFilters) {
        Object.entries(normalizedFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = `/api/stores/${storeId}/materials${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch materials");
      }

      const data: ApiSuccessResponse<MaterialsResponse> = await response.json();
      return data.data;
    },
    enabled: !!storeId,
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

/**
 * Fetch a single material by ID
 */
export function useMaterial(storeId: string, id: string) {
  return useQuery<MaterialWithSuppliers>({
    queryKey: materialKeys.detail(storeId, id),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/materials/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch material");
      }

      const data: ApiSuccessResponse<MaterialWithSuppliers> = await response.json();
      return data.data;
    },
    enabled: !!storeId && !!id,
  });
}

/**
 * Create a new material with optimistic updates
 * Real-time: Updates UI immediately, syncs with server in background
 */
export function useCreateMaterial(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    MaterialWithSuppliers,
    Error,
    Omit<CreateIngredientInput, "storeId">,
    { previousMaterials: MaterialsResponse | undefined }
  >({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/materials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create material");
      }

      const data: ApiSuccessResponse<MaterialWithSuppliers> = await response.json();
      return data.data;
    },
    onMutate: async (newMaterial) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: materialKeys.lists(storeId) });

      // Snapshot previous value
      const previousMaterials = queryClient.getQueryData<MaterialsResponse>(
        materialKeys.list(storeId)
      );

      // Optimistically update cache
      if (previousMaterials) {
        // Create optimistic material with proper structure
        // Note: Using type assertion because this is temporary data that will be replaced
        // with real server data in onSuccess. Decimal fields will be converted by server.
        const optimisticMaterial = {
          ...newMaterial,
          id: `temp-${Date.now()}`, // Temporary ID
          storeId,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentStock: newMaterial.currentStock ?? 0,
          minStock: newMaterial.minStock ?? 0,
          maxStock: newMaterial.maxStock ?? 1000,
          materialSuppliers: [], // Use materialSuppliers, not suppliers
        } as unknown as MaterialWithSuppliers;

        queryClient.setQueryData<MaterialsResponse>(materialKeys.list(storeId), {
          ...previousMaterials,
          materials: [...previousMaterials.materials, optimisticMaterial],
          total: previousMaterials.total + 1,
        });
      }

      return { previousMaterials };
    },
    onSuccess: async (newMaterial) => {
      // Update with real data from server (replace optimistic update)
      const currentData = queryClient.getQueryData<MaterialsResponse>(
        materialKeys.list(storeId)
      );

      if (currentData) {
        // Replace optimistic material with real one immediately
        queryClient.setQueryData<MaterialsResponse>(materialKeys.list(storeId), {
          ...currentData,
          materials: currentData.materials.map((m) =>
            m.id.startsWith("temp-") ? newMaterial : m
          ),
        });
      }

      // Invalidate materials list for immediate UI update
      // Note: We DON'T invalidate related queries (suppliers, alerts, recipes, stock movements)
      // on CREATE because adding a new material doesn't affect those existing resources.
      // This is a performance optimization - related queries only need invalidation
      // on UPDATE/DELETE operations where relationships might change.
      await queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      });
    },
    onError: (error, newMaterial, context) => {
      // Rollback optimistic update on error
      if (context?.previousMaterials) {
        queryClient.setQueryData(materialKeys.list(storeId), context.previousMaterials);
      }
    },
  });
}

/**
 * Update an existing material with cache invalidation
 */
export function useUpdateMaterial(storeId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation<MaterialWithSuppliers, Error, UpdateIngredientInput>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/materials/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to update material");
      }

      const data: ApiSuccessResponse<MaterialWithSuppliers> = await response.json();
      return data.data;
    },
    onSuccess: async (updatedMaterial) => {
      // Update cache for specific material (optimistic update)
      queryClient.setQueryData(materialKeys.detail(storeId, id), updatedMaterial);

      // Invalidate materials list first (blocking) for immediate UI update
      await queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      });

      // Invalidate other related queries in background (skip materials)
      invalidateMaterialRelatedQueries(queryClient, storeId, true).catch(console.warn);
    },
  });
}

/**
 * Delete a material with cache invalidation
 */
export function useDeleteMaterial(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/stores/${storeId}/materials/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to delete material");
      }

      const data: ApiSuccessResponse<{ message: string }> = await response.json();
      return data.data;
    },
    onSuccess: async (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, deletedId) });

      // Invalidate materials list first (blocking) for immediate UI update
      await queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      });

      // Invalidate other related queries in background (skip materials)
      invalidateMaterialRelatedQueries(queryClient, storeId, true).catch(console.warn);
    },
  });
}

/**
 * Bulk delete materials with cache invalidation
 */
export function useBulkDeleteMaterials(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string; deletedCount: number }, Error, BulkDeleteInput>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/materials/bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to delete materials");
      }

      const data: ApiSuccessResponse<{ message: string; deletedCount: number }> =
        await response.json();
      return data.data;
    },
    onSuccess: async (_, { ids }) => {
      // Remove all deleted items from cache
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, id) });
      });

      // Invalidate materials list first (blocking) for immediate UI update
      await queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      });

      // Invalidate other related queries in background (skip materials)
      invalidateMaterialRelatedQueries(queryClient, storeId, true).catch(console.warn);
    },
  });
}

/**
 * Export materials to CSV
 */
export function useExportMaterials(storeId: string) {
  return useMutation<Blob, Error, MaterialFilterInput | undefined>({
    mutationFn: async (filters) => {
      // Build query string
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = `/api/stores/${storeId}/materials/export${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to export materials");
      }

      return response.blob();
    },
    onSuccess: (blob) => {
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `materials-${storeId}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}
