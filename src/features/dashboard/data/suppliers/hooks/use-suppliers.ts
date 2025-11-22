import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateSupplierInput, UpdateSupplierInput } from "@/lib/validation/inventory.schemas";
import { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import { invalidateSupplierRelatedQueries } from "@/lib/utils/cache-helpers";

// Response interfaces
export interface SuppliersResponse {
  suppliers: SupplierWithRelations[];
  total: number;
}

export interface SupplierFilterInput {
  search?: string;
  sortBy?: "name" | "contactPerson" | "email" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

// Query keys for cache management
export const supplierKeys = {
  all: (storeId: string) => ["suppliers", storeId] as const,
  lists: (storeId: string) => [...supplierKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: SupplierFilterInput) =>
    [...supplierKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...supplierKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...supplierKeys.details(storeId), id] as const,
};

// API Functions
async function fetchSupplierById(
  storeId: string,
  supplierId: string
): Promise<SupplierWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch supplier");
  }

  return response.json();
}

async function createSupplier(
  storeId: string,
  data: CreateSupplierInput
): Promise<SupplierWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create supplier");
  }

  return response.json();
}

async function updateSupplier(
  storeId: string,
  supplierId: string,
  data: UpdateSupplierInput
): Promise<SupplierWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update supplier");
  }

  return response.json();
}

async function deleteSupplier(storeId: string, supplierId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete supplier");
  }
}

async function bulkDeleteSuppliers(
  storeId: string,
  supplierIds: string[]
): Promise<{ deletedCount: number }> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: supplierIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete suppliers");
  }

  return response.json();
}

async function exportSuppliers(storeId: string, filters: SupplierFilterInput): Promise<void> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

  const response = await fetch(`/api/stores/${storeId}/suppliers/export?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to export suppliers");
  }

  // Download CSV file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `suppliers-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// React Query Hooks

export interface UseSuppliersOptions {
  enabled?: boolean;
}

/**
 * Fetch all suppliers with filters
 */
export function useSuppliers(
  storeId: string,
  filters: SupplierFilterInput,
  options?: UseSuppliersOptions
) {
  return useQuery<SuppliersResponse>({
    queryKey: supplierKeys.list(storeId, filters),
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
      const url = `/api/stores/${storeId}/suppliers${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();

        // Handle 403 Forbidden (subscription feature locked)
        if (response.status === 403 && error.code === "SUBSCRIPTION_FEATURE_LOCKED") {
          const { createSubscriptionError } = await import("@/types/errors");
          throw createSubscriptionError(
            error.message || "Supplier Management is only available in Pro and Enterprise plans",
            true
          );
        }

        throw new Error(error.error || "Failed to fetch suppliers");
      }

      return response.json();
    },
    // Respect external enabled option (e.g., for dialog lazy loading)
    enabled: !!storeId && (options?.enabled ?? true),
    // Real-time configuration: Static data - no polling, longer stale time
    staleTime: 5 * 60 * 1000, // 5 minutes (suppliers don't change often)
    refetchInterval: false, // No polling for static data
    refetchOnWindowFocus: true, // Refetch on window focus if stale
    meta: {
      refetchInterval: false, // Store in meta for smart polling
    },
  });
}

/**
 * Fetch single supplier by ID
 */
export function useSupplier(storeId: string, supplierId: string | null) {
  return useQuery<SupplierWithRelations>({
    queryKey: supplierKeys.detail(storeId, supplierId!),
    queryFn: () => fetchSupplierById(storeId, supplierId!),
    enabled: !!storeId && !!supplierId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Create supplier mutation
 */
export function useCreateSupplier(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierInput) => createSupplier(storeId, data),
    onSuccess: () => {
      // Non-blocking cache invalidation: Only invalidate suppliers immediately
      // Other queries (materials) will sync in background
      // This allows UI to respond faster without waiting for all invalidations
      invalidateSupplierRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Update supplier mutation
 */
export function useUpdateSupplier(storeId: string, supplierId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSupplierInput) => updateSupplier(storeId, supplierId, data),
    onSuccess: () => {
      // Update cache for specific supplier (optimistic update)
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(storeId, supplierId) });
      // Non-blocking cache invalidation: Only invalidate suppliers immediately
      // Other queries (materials) will sync in background
      invalidateSupplierRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Delete supplier mutation
 */
export function useDeleteSupplier(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplierId: string) => deleteSupplier(storeId, supplierId),
    onSuccess: (_, supplierId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: supplierKeys.detail(storeId, supplierId) });
      // Non-blocking cache invalidation: Only invalidate suppliers immediately
      // Other queries (materials) will sync in background
      invalidateSupplierRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Bulk delete suppliers mutation
 */
export function useBulkDeleteSuppliers(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplierIds: string[]) => bulkDeleteSuppliers(storeId, supplierIds),
    onSuccess: (_, supplierIds) => {
      // Remove all deleted items from cache
      supplierIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: supplierKeys.detail(storeId, id) });
      });
      // Non-blocking cache invalidation: Only invalidate suppliers immediately
      // Other queries (materials) will sync in background
      invalidateSupplierRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Export suppliers
 */
export function useExportSuppliers() {
  return useMutation({
    mutationFn: ({ storeId, filters }: { storeId: string; filters: SupplierFilterInput }) =>
      exportSuppliers(storeId, filters),
  });
}
