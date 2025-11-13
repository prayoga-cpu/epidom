import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateSupplierInput, UpdateSupplierInput } from "@/lib/validation/inventory.schemas";
import { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import type { ApiSuccessResponse } from "@/types/api/responses";
import { DEFAULT_QUERY_OPTIONS } from "@/lib/react-query/constants";
import { fetchWithErrorHandling, ApiError } from "@/lib/api/client";
import { exportToCSV } from "@/lib/utils/export";
import { buildQueryParams } from "@/lib/utils/query-params";

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
  return fetchWithErrorHandling<SupplierWithRelations>(`/api/stores/${storeId}/suppliers/${supplierId}`);
}

async function createSupplier(
  storeId: string,
  data: CreateSupplierInput
): Promise<SupplierWithRelations> {
  return fetchWithErrorHandling<SupplierWithRelations>(`/api/stores/${storeId}/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function updateSupplier(
  storeId: string,
  supplierId: string,
  data: UpdateSupplierInput
): Promise<SupplierWithRelations> {
  return fetchWithErrorHandling<SupplierWithRelations>(`/api/stores/${storeId}/suppliers/${supplierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function deleteSupplier(storeId: string, supplierId: string): Promise<void> {
  await fetchWithErrorHandling<void>(`/api/stores/${storeId}/suppliers/${supplierId}`, {
    method: "DELETE",
  });
}

async function bulkDeleteSuppliers(
  storeId: string,
  supplierIds: string[]
): Promise<{ deletedCount: number }> {
  return fetchWithErrorHandling<{ deletedCount: number }>(`/api/stores/${storeId}/suppliers/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: supplierIds }),
  });
}

async function exportSuppliers(storeId: string, filters: SupplierFilterInput): Promise<void> {
  await exportToCSV(`/api/stores/${storeId}/suppliers/export`, "export", "suppliers", filters as Record<string, unknown>);
}

// React Query Hooks

/**
 * Fetch all suppliers with filters
 */
export function useSuppliers(storeId: string, filters: SupplierFilterInput) {
  return useQuery<SuppliersResponse>({
    queryKey: supplierKeys.list(storeId, filters),
    queryFn: async () => {
      const params = buildQueryParams(filters as Record<string, unknown>);
      const url = `/api/stores/${storeId}/suppliers${params.toString() ? `?${params.toString()}` : ""}`;
      // fetchWithErrorHandling already handles ApiError properly
      return fetchWithErrorHandling<SuppliersResponse>(url);
    },
    enabled: !!storeId,
    ...DEFAULT_QUERY_OPTIONS.inventory,
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
    ...DEFAULT_QUERY_OPTIONS.inventory,
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
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists(storeId) });
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
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists(storeId) });
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(storeId, supplierId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists(storeId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists(storeId) });
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
