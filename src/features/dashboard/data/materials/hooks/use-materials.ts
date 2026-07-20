"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateIngredientInput,
  UpdateIngredientInput,
  MaterialFilterInput,
  BulkDeleteInput,
} from "@/lib/validation/inventory.schemas";
import { ApiSuccessResponse } from "@/types/api/responses";
import { ApiClientError } from "@/lib/api/client";
import { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import { invalidateMaterialRelatedQueries } from "@/lib/utils/cache-helpers";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import { trackEvent } from "@/lib/analytics";

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
export function useMaterials(
  storeId: string,
  filters?: MaterialFilterInput,
  initialData?: MaterialsResponse
) {
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
        throw new ApiClientError(errorData, response.status);
      }

      const data: ApiSuccessResponse<MaterialsResponse> = await response.json();
      return data.data;
    },
    enabled: !!storeId,
    initialData, // ✅ Accept initial data from Server Component
    // Real-time configuration: Aggressive polling for instant cross-tab updates
    staleTime: 3 * 1000, // 3 seconds - consider data stale faster
    refetchInterval: 5 * 1000, // Poll every 5 seconds - 6x faster for real-time sync
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
        throw new ApiClientError(errorData, response.status);
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
        throw new ApiClientError(errorData, response.status);
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
      trackEvent("create_material", { event_category: "dashboard_activity" });

      // Update with real data from server (replace optimistic update)
      // Performance optimization: Update all cached material lists directly instead of invalidating
      // This avoids blocking refetch operations that slow down the UI
      const allMaterialQueries = queryClient.getQueriesData<MaterialsResponse>({
        queryKey: materialKeys.lists(storeId),
      });

      // Update all cached material lists with the new material
      allMaterialQueries.forEach(([queryKey, cachedData]) => {
        if (cachedData) {
          // Check if the new material matches the current filter (if any)
          // For now, we'll add it to all lists - filtering will happen on next refetch if needed
          const hasOptimisticMaterial = cachedData.materials.some((m) => m.id.startsWith("temp-"));

          if (hasOptimisticMaterial) {
            // Replace optimistic material with real one
            queryClient.setQueryData<MaterialsResponse>(queryKey, {
              ...cachedData,
              materials: cachedData.materials.map((m) =>
                m.id.startsWith("temp-") ? newMaterial : m
              ),
            });
          } else {
            // Add new material to the list (if it matches filters, it will be included)
            // This is a best-effort update - exact filtering happens on server
            queryClient.setQueryData<MaterialsResponse>(queryKey, {
              ...cachedData,
              materials: [...cachedData.materials, newMaterial],
              total: cachedData.total + 1,
            });
          }
        }
      });

      // Invalidate in background (non-blocking) to ensure data consistency
      // This allows UI to update immediately while background sync happens
      queryClient
        .invalidateQueries({
          queryKey: ["materials", storeId],
          exact: false,
        })
        .catch(console.warn); // Non-blocking - errors won't affect UI
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
/**
 * Update an existing material with optimistic updates
 * Real-time: Updates UI immediately, syncs with server in background
 */
export function useUpdateMaterial(storeId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation<
    MaterialWithSuppliers,
    Error,
    UpdateIngredientInput,
    {
      previousMaterial: MaterialWithSuppliers | undefined;
      previousQueries: Array<[readonly unknown[], MaterialsResponse | undefined]>;
    }
  >({
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
        throw new ApiClientError(errorData, response.status);
      }

      const data: ApiSuccessResponse<MaterialWithSuppliers> = await response.json();
      return data.data;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: materialKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: materialKeys.detail(storeId, id) });

      // Snapshot previous values for rollback
      const previousMaterial = queryClient.getQueryData<MaterialWithSuppliers>(
        materialKeys.detail(storeId, id)
      );
      const previousQueries = queryClient.getQueriesData<MaterialsResponse>({
        queryKey: materialKeys.lists(storeId),
      });

      // Optimistically update detail cache
      if (previousMaterial) {
        queryClient.setQueryData<MaterialWithSuppliers>(materialKeys.detail(storeId, id), {
          ...previousMaterial,
          ...newData,
          updatedAt: new Date(), // Update timestamp
        } as MaterialWithSuppliers);
      }

      // Optimistically update all list caches
      queryClient.setQueriesData<MaterialsResponse>(
        { queryKey: materialKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.materials) return oldData;
          return {
            ...oldData,
            materials: oldData.materials.map((m) =>
              m.id === id
                ? ({
                    ...m,
                    ...newData,
                    updatedAt: new Date(),
                  } as MaterialWithSuppliers)
                : m
            ),
          };
        }
      );

      return { previousMaterial, previousQueries };
    },
    onError: (error, newData, context) => {
      // Rollback optimistic update on error
      if (context?.previousMaterial) {
        queryClient.setQueryData(materialKeys.detail(storeId, id), context.previousMaterial);
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: async (updatedMaterial) => {
      // Replace optimistic data with real server data
      queryClient.setQueryData(materialKeys.detail(storeId, id), updatedMaterial);

      // Update in all list caches with real data
      queryClient.setQueriesData<MaterialsResponse>(
        { queryKey: materialKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.materials) return oldData;
          return {
            ...oldData,
            materials: oldData.materials.map((m) => (m.id === id ? updatedMaterial : m)),
          };
        }
      );

      // Non-blocking cache invalidation for related queries
      invalidateMaterialRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Delete a material with cache invalidation
 */
/**
 * Delete a material with optimistic updates
 * Real-time: Removes from UI immediately, syncs with server in background
 */
export function useDeleteMaterial(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    string,
    { previousQueries: Array<[readonly unknown[], MaterialsResponse | undefined]> }
  >({
    mutationFn: async (id) => {
      const response = await fetch(`/api/stores/${storeId}/materials/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ApiClientError(errorData, response.status);
      }

      const data: ApiSuccessResponse<{ message: string }> = await response.json();
      return data.data;
    },
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: materialKeys.lists(storeId) });

      // Snapshot previous queries
      const previousQueries = queryClient.getQueriesData<MaterialsResponse>({
        queryKey: materialKeys.lists(storeId),
      });

      // Optimistically remove from all matching caches
      queryClient.setQueriesData<MaterialsResponse>(
        { queryKey: materialKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.materials) return oldData;
          return {
            ...oldData,
            materials: oldData.materials.filter((m) => m.id !== deletedId),
            total: Math.max(0, oldData.total - 1),
          };
        }
      );

      return { previousQueries };
    },
    onError: (error, deletedId, context) => {
      // Rollback optimistic update on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: async (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, deletedId) });

      // Non-blocking cache invalidation for related queries
      invalidateMaterialRelatedQueries(queryClient, storeId, false, true);
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
        throw new ApiClientError(errorData, response.status);
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
        throw new ApiClientError(errorData, response.status);
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
