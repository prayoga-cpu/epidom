import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateProductionRelatedQueries } from "@/lib/react-query/cache-utils";
import {
  CreateProductionBatchFormInput,
  UpdateProductionBatchInput,
  ProductionBatchFilterInput,
  CompleteProductionInput,
  CancelProductionInput,
} from "@/lib/validation/production.schemas";
import type { ApiSuccessResponse } from "@/types/api/responses";

// Query Key Factory
export const productionBatchKeys = {
  all: (storeId: string) => ["production-batches", storeId] as const,
  lists: (storeId: string) => [...productionBatchKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: ProductionBatchFilterInput) =>
    [...productionBatchKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...productionBatchKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...productionBatchKeys.details(storeId), id] as const,
};

// Types
export interface ProductionBatchWithRelations {
  id: string;
  batchNumber: string;
  productId: string;
  recipeId: string | null;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduledDate: Date;
  completedDate: Date | null;
  notes: string | null;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  recipe: {
    id: string;
    name: string;
    yieldQuantity: number;
    yieldUnit: string;
    ingredients: Array<{
      id: string;
      materialId: string;
      quantity: number;
      unit: string;
      material: {
        id: string;
        name: string;
        currentStock: number;
        unit: string;
        unitCost: number;
      };
    }>;
  } | null;
  stockMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    unit: string;
    createdAt: Date;
  }>;
}

export interface ProductionBatchesResponse {
  batches: ProductionBatchWithRelations[];
  total: number;
}

// API Functions

async function fetchProductionBatches(
  storeId: string,
  filters: ProductionBatchFilterInput
): Promise<ProductionBatchesResponse> {
  const params = new URLSearchParams();

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      params.append("status", filters.status.join(","));
    } else {
      params.append("status", filters.status);
    }
  }
  if (filters.recipeId) params.append("recipeId", filters.recipeId);
  if (filters.productId) params.append("productId", filters.productId);
  if (filters.startDate) params.append("startDate", filters.startDate.toISOString());
  if (filters.endDate) params.append("endDate", filters.endDate.toISOString());
  if (filters.search) params.append("search", filters.search);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
  if (filters.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters.take !== undefined) params.append("take", filters.take.toString());

  const response = await fetch(`/api/stores/${storeId}/production-batches?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to fetch production batches");
  }

  const data: ApiSuccessResponse<ProductionBatchesResponse> = await response.json();
  return data.data;
}

async function fetchProductionBatchById(
  storeId: string,
  batchId: string
): Promise<ProductionBatchWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to fetch production batch");
  }

  const data: ApiSuccessResponse<ProductionBatchWithRelations> = await response.json();
  return data.data;
}

async function createProductionBatch(
  storeId: string,
  data: CreateProductionBatchFormInput
): Promise<ProductionBatchWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/production-batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to start production");
  }

  const result: ApiSuccessResponse<ProductionBatchWithRelations> = await response.json();
  return result.data;
}

async function updateProductionBatch(
  storeId: string,
  batchId: string,
  data: UpdateProductionBatchInput
): Promise<ProductionBatchWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to update production batch");
  }

  const result: ApiSuccessResponse<ProductionBatchWithRelations> = await response.json();
  return result.data;
}

async function completeProduction(
  storeId: string,
  batchId: string,
  data: CompleteProductionInput
): Promise<ProductionBatchWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to complete production");
  }

  const result: ApiSuccessResponse<ProductionBatchWithRelations> = await response.json();
  return result.data;
}

async function cancelProduction(
  storeId: string,
  batchId: string,
  data: CancelProductionInput
): Promise<ProductionBatchWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to cancel production");
  }

  const result: ApiSuccessResponse<ProductionBatchWithRelations> = await response.json();
  return result.data;
}

async function deleteProductionBatch(storeId: string, batchId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to delete production batch");
  }
}

// React Query Hooks

/**
 * Fetch all production batches with filters
 */
export function useProductionBatches(storeId: string, filters: ProductionBatchFilterInput) {
  return useQuery({
    queryKey: productionBatchKeys.list(storeId, filters),
    queryFn: () => fetchProductionBatches(storeId, filters),
    enabled: !!storeId,
    staleTime: 60 * 1000, // 1 minute - data considered fresh for 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes - cache kept for 5 minutes after unmount
  });
}

/**
 * Fetch single production batch by ID
 */
export function useProductionBatch(storeId: string, batchId: string | null) {
  return useQuery({
    queryKey: productionBatchKeys.detail(storeId, batchId!),
    queryFn: () => fetchProductionBatchById(storeId, batchId!),
    enabled: !!storeId && !!batchId,
    staleTime: 60 * 1000, // 1 minute - data considered fresh for 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes - cache kept for 5 minutes after unmount
  });
}

/**
 * Start production (create batch) mutation
 */
export function useStartProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductionBatchFormInput) => createProductionBatch(storeId, data),
    onSuccess: async () => {
      await invalidateProductionRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Update production batch mutation
 */
export function useUpdateProductionBatch(storeId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProductionBatchInput) => updateProductionBatch(storeId, batchId, data),
    onSuccess: async () => {
      await invalidateProductionRelatedQueries(queryClient, storeId, batchId);
    },
  });
}

/**
 * Complete production mutation
 */
export function useCompleteProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, data }: { batchId: string; data: CompleteProductionInput }) =>
      completeProduction(storeId, batchId, data),
    onSuccess: async () => {
      await invalidateProductionRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Cancel production mutation
 */
export function useCancelProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, data }: { batchId: string; data: CancelProductionInput }) =>
      cancelProduction(storeId, batchId, data),
    onSuccess: async () => {
      await invalidateProductionRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Delete production batch mutation
 */
export function useDeleteProductionBatch(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchId: string) => deleteProductionBatch(storeId, batchId),
    onSuccess: async () => {
      await invalidateProductionRelatedQueries(queryClient, storeId);
    },
  });
}
