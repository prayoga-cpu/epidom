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
 */
export function useCreateMaterial(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<MaterialWithSuppliers, Error, Omit<CreateIngredientInput, "storeId">>({
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
    onSuccess: () => {
      // Invalidate all material lists for this store
      queryClient.invalidateQueries({ queryKey: materialKeys.lists(storeId) });
      // Invalidate supplier lists to update material counts in supplier cards
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists(storeId) });
      // Invalidate alerts (new material may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (initial stock movement may have been created)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
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
    onSuccess: (updatedMaterial) => {
      // Update cache for specific material
      queryClient.setQueryData(materialKeys.detail(storeId, id), updatedMaterial);
      // Invalidate material lists to refetch
      queryClient.invalidateQueries({ queryKey: materialKeys.lists(storeId) });
      // Invalidate supplier lists to update material counts in supplier cards
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists(storeId) });
      // Invalidate alerts (stock changes may affect low stock alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (new movement may have been created)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
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
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, deletedId) });
      // Invalidate material lists to refetch
      queryClient.invalidateQueries({ queryKey: materialKeys.lists(storeId) });
      // Invalidate alerts (deleted material may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
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
    onSuccess: (_, { ids }) => {
      // Remove all deleted items from cache
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: materialKeys.detail(storeId, id) });
      });
      // Invalidate material lists to refetch
      queryClient.invalidateQueries({ queryKey: materialKeys.lists(storeId) });
      // Invalidate alerts (deleted materials may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
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
