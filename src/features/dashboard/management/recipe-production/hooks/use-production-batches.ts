import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateProductionBatchFormInput,
  UpdateProductionBatchInput,
  ProductionBatchFilterInput,
  CompleteProductionInput,
  CancelProductionInput,
} from "@/lib/validation/production.schemas";
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";

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
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch production batches");
  }

  return response.json();
}

async function fetchProductionBatchById(
  storeId: string,
  batchId: string
): Promise<ProductionBatchWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch production batch");
  }

  return response.json();
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
    const error = await response.json();
    throw new Error(error.error || "Failed to start production");
  }

  return response.json();
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
    const error = await response.json();
    throw new Error(error.error || "Failed to update production batch");
  }

  return response.json();
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
    const error = await response.json();
    throw new Error(error.error || "Failed to complete production");
  }

  return response.json();
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
    const error = await response.json();
    throw new Error(error.error || "Failed to cancel production");
  }

  return response.json();
}

async function deleteProductionBatch(storeId: string, batchId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/production-batches/${batchId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete production batch");
  }
}

// React Query Hooks

/**
 * Fetch all production batches with filters
 */
export function useProductionBatches(storeId: string, filters: ProductionBatchFilterInput) {
  return useQuery({
    queryKey: ["production-batches", storeId, filters],
    queryFn: () => fetchProductionBatches(storeId, filters),
    enabled: !!storeId,
  });
}

/**
 * Fetch single production batch by ID
 */
export function useProductionBatch(storeId: string, batchId: string | null) {
  return useQuery({
    queryKey: ["production-batches", storeId, batchId],
    queryFn: () => fetchProductionBatchById(storeId, batchId!),
    enabled: !!storeId && !!batchId,
  });
}

/**
 * Start production (create batch) mutation
 */
export function useStartProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductionBatchFormInput) => createProductionBatch(storeId, data),
    onSuccess: () => {
      // Use refetchQueries to force immediate refetch of active queries
      queryClient.refetchQueries({
        queryKey: ["production-batches", storeId],
        type: 'active' // Only refetch active queries
      });
      queryClient.invalidateQueries({ queryKey: ["materials", storeId] });
      // Invalidate alerts (material stock may have changed)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (materials were consumed)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId, batchId] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      // Invalidate alerts (product stock increased)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (product was added)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
      queryClient.invalidateQueries({ queryKey: ["materials", storeId] });
      // Invalidate alerts (material stock may have been refunded)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (materials may have been returned)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
    },
  });
}
