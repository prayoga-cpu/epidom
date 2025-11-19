"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateStoreInput } from "@/lib/validation/business.schemas";
import { ApiSuccessResponse } from "@/types/api/responses";

// Store type matching Prisma schema
export interface Store {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  image: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Query keys for cache management (DRY principle)
export const storeKeys = {
  all: ["stores"] as const,
  lists: () => [...storeKeys.all, "list"] as const,
  list: () => [...storeKeys.lists()] as const,
  details: () => [...storeKeys.all, "detail"] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
};

/**
 * Fetch all stores for the current user's business
 */
export function useStores() {
  return useQuery<Store[]>({
    queryKey: storeKeys.list(),
    queryFn: async () => {
      const response = await fetch("/api/stores");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch stores");
      }

      const data: ApiSuccessResponse<Store[]> = await response.json();
      return data.data;
    },
  });
}

/**
 * Fetch a single store by ID
 */
export function useStore(id: string) {
  return useQuery<Store>({
    queryKey: storeKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch store");
      }

      const data: ApiSuccessResponse<Store> = await response.json();
      return data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new store with optimistic updates
 */
export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation<Store, Error, CreateStoreInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create store");
      }

      const data: ApiSuccessResponse<Store> = await response.json();
      return data.data;
    },
    onSuccess: () => {
      // Invalidate stores list to refetch
      queryClient.invalidateQueries({ queryKey: storeKeys.list() });
      // Invalidate subscription status to update storeUsage (canCreateMore)
      // This ensures the "Create Store" button updates immediately after creating a store
      queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
    },
  });
}

/**
 * Update an existing store with cache invalidation
 */
export function useUpdateStore(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Store, Error, Partial<CreateStoreInput>>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to update store");
      }

      const data: ApiSuccessResponse<Store> = await response.json();
      return data.data;
    },
    onSuccess: (updatedStore) => {
      // Update cache for specific store
      queryClient.setQueryData(storeKeys.detail(id), updatedStore);
      // Invalidate stores list to refetch
      queryClient.invalidateQueries({ queryKey: storeKeys.list() });
    },
  });
}

/**
 * Delete (deactivate) a store with cache invalidation
 */
export function useDeleteStore() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/stores/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to delete store");
      }

      const data: ApiSuccessResponse<{ message: string }> = await response.json();
      return data.data;
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: storeKeys.detail(deletedId) });
      // Invalidate stores list to refetch
      queryClient.invalidateQueries({ queryKey: storeKeys.list() });
    },
  });
}
