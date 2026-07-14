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
import { trackEvent } from "@/lib/analytics";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
} from "@/lib/utils/cache-helpers";

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
    productionTimeMinutes?: number;
    costPerBatch?: number;
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

// Query keys for cache management (DRY principle)
export const productionBatchKeys = {
  all: (storeId: string) => ["production-batches", storeId] as const,
  lists: (storeId: string) => [...productionBatchKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: ProductionBatchFilterInput) =>
    [...productionBatchKeys.lists(storeId), normalizeFilters(filters)] as const,
  details: (storeId: string) => [...productionBatchKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...productionBatchKeys.details(storeId), id] as const,
};

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

  const result = await response.json();
  // API returns { success: true, data: {...} }
  return result.success === true ? result.data : result;
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

  const result = await response.json();
  // API returns { success: true, data: {...} }
  return result.success === true ? result.data : result;
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
    const errorMessage =
      typeof error.error === "string"
        ? error.error
        : error.error?.message || JSON.stringify(error.error) || "Failed to start production";
    throw new Error(errorMessage);
  }

  const result = await response.json();
  // API returns { success: true, data: {...} }
  return result.success === true ? result.data : result;
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

  const result = await response.json();
  // API returns { success: true, data: {...} }
  return result.success === true ? result.data : result;
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

  const result = await response.json();
  // Complete/Cancel API returns batch directly (not wrapped)
  return result;
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

  const result = await response.json();
  // Complete/Cancel API returns batch directly (not wrapped)
  return result;
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
 * Real-time enabled: Polls every 30 seconds when tab is active
 */
export function useProductionBatches(
  storeId: string,
  filters: ProductionBatchFilterInput,
  initialData?: ProductionBatchesResponse
) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: productionBatchKeys.list(storeId, normalizedFilters),
    queryFn: () => fetchProductionBatches(storeId, normalizedFilters || filters),
    enabled: !!storeId,
    initialData, // ✅ Accept initial data from Server Component
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
 * Fetch single production batch by ID
 */
export function useProductionBatch(storeId: string, batchId: string | null) {
  return useQuery({
    queryKey: productionBatchKeys.detail(storeId, batchId!),
    queryFn: () => fetchProductionBatchById(storeId, batchId!),
    enabled: !!storeId && !!batchId,
  });
}

/**
 * Start production (create batch) mutation
 */
/**
 * Start production (create batch) mutation with optimistic updates
 */
export function useStartProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductionBatchWithRelations,
    Error,
    CreateProductionBatchFormInput,
    { previousQueries: Array<[readonly unknown[], ProductionBatchesResponse | undefined]> }
  >({
    mutationFn: (data: CreateProductionBatchFormInput) => createProductionBatch(storeId, data),
    onMutate: async (newBatch) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.lists(storeId) });

      // Snapshot previous queries
      const previousQueries = queryClient.getQueriesData<ProductionBatchesResponse>({
        queryKey: productionBatchKeys.lists(storeId),
      });

      // Optimistically update all matching caches
      queryClient.setQueriesData<ProductionBatchesResponse>(
        { queryKey: productionBatchKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.batches) return oldData;

          // Create a temporary optimistic batch
          const optimisticBatch = {
            id: `temp-${Date.now()}`,
            batchNumber: "PENDING", // Will be replaced by server
            productId: newBatch.productId,
            recipeId: newBatch.recipeId || null,
            plannedQuantity: newBatch.plannedQuantity,
            actualQuantity: null,
            unit: "unit", // Placeholder, should be fetched from product/recipe
            status: "PLANNED",
            scheduledDate: newBatch.scheduledDate,
            completedDate: null,
            notes: newBatch.notes || null,
            storeId,
            createdAt: new Date(),
            updatedAt: new Date(),
            product: { id: newBatch.productId, name: "Loading...", sku: "", unit: "" }, // Placeholder
            recipe: null, // Placeholder
            stockMovements: [],
          } as unknown as ProductionBatchWithRelations;

          return {
            ...oldData,
            batches: [optimisticBatch, ...oldData.batches],
            total: oldData.total + 1,
          };
        }
      );

      return { previousQueries };
    },
    onError: (error, newBatch, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      trackEvent("create_production_batch", { event_category: "dashboard_activity" });

      // Invalidate queries to get real data (including relations)
      // Use non-blocking invalidation helper which handles materials, recipes, and batches
      invalidateMaterialRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Update production batch mutation with optimistic updates
 */
export function useUpdateProductionBatch(storeId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductionBatchWithRelations,
    Error,
    UpdateProductionBatchInput,
    {
      previousBatch: ProductionBatchWithRelations | undefined;
      previousQueries: Array<[readonly unknown[], ProductionBatchesResponse | undefined]>;
    }
  >({
    mutationFn: (data: UpdateProductionBatchInput) => updateProductionBatch(storeId, batchId, data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.detail(storeId, batchId) });

      const previousBatch = queryClient.getQueryData<ProductionBatchWithRelations>(
        productionBatchKeys.detail(storeId, batchId)
      );
      const previousQueries = queryClient.getQueriesData<ProductionBatchesResponse>({
        queryKey: productionBatchKeys.lists(storeId),
      });

      // Optimistically update detail
      if (previousBatch) {
        queryClient.setQueryData<ProductionBatchWithRelations>(
          productionBatchKeys.detail(storeId, batchId),
          { ...previousBatch, ...newData, updatedAt: new Date() } as ProductionBatchWithRelations
        );
      }

      // Optimistically update lists
      queryClient.setQueriesData<ProductionBatchesResponse>(
        { queryKey: productionBatchKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.batches) return oldData;
          return {
            ...oldData,
            batches: oldData.batches.map((b) =>
              b.id === batchId
                ? ({ ...b, ...newData, updatedAt: new Date() } as ProductionBatchWithRelations)
                : b
            ),
          };
        }
      );

      return { previousBatch, previousQueries };
    },
    onError: (error, newData, context) => {
      if (context?.previousBatch) {
        queryClient.setQueryData(
          productionBatchKeys.detail(storeId, batchId),
          context.previousBatch
        );
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedBatch) => {
      queryClient.setQueryData(productionBatchKeys.detail(storeId, batchId), updatedBatch);
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
    },
  });
}

/**
 * Complete production mutation with optimistic updates
 */
export function useCompleteProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductionBatchWithRelations,
    Error,
    { batchId: string; data: CompleteProductionInput },
    {
      previousBatch: ProductionBatchWithRelations | undefined;
      previousQueries: Array<[readonly unknown[], ProductionBatchesResponse | undefined]>;
    }
  >({
    mutationFn: ({ batchId, data }) => completeProduction(storeId, batchId, data),
    onMutate: async ({ batchId, data }) => {
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.detail(storeId, batchId) });

      const previousBatch = queryClient.getQueryData<ProductionBatchWithRelations>(
        productionBatchKeys.detail(storeId, batchId)
      );
      const previousQueries = queryClient.getQueriesData<ProductionBatchesResponse>({
        queryKey: productionBatchKeys.lists(storeId),
      });

      // Optimistically update detail
      if (previousBatch) {
        queryClient.setQueryData<ProductionBatchWithRelations>(
          productionBatchKeys.detail(storeId, batchId),
          {
            ...previousBatch,
            status: "COMPLETED",
            actualQuantity: data.actualQuantity,
            completedDate: data.completedDate,
            notes: data.notes || previousBatch.notes,
            updatedAt: new Date(),
          } as ProductionBatchWithRelations
        );
      }

      // Optimistically update lists
      queryClient.setQueriesData<ProductionBatchesResponse>(
        { queryKey: productionBatchKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.batches) return oldData;
          return {
            ...oldData,
            batches: oldData.batches.map((b) =>
              b.id === batchId
                ? ({
                    ...b,
                    status: "COMPLETED",
                    actualQuantity: data.actualQuantity,
                    completedDate: data.completedDate,
                    notes: data.notes || b.notes,
                    updatedAt: new Date(),
                  } as ProductionBatchWithRelations)
                : b
            ),
          };
        }
      );

      return { previousBatch, previousQueries };
    },
    onError: (error, vars, context) => {
      if (context?.previousBatch) {
        queryClient.setQueryData(
          productionBatchKeys.detail(storeId, vars.batchId),
          context.previousBatch
        );
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedBatch) => {
      queryClient.setQueryData(productionBatchKeys.detail(storeId, updatedBatch.id), updatedBatch);
      // Use non-blocking invalidation helper
      invalidateMaterialRelatedQueries(queryClient, storeId, false);
      // Also invalidate products as completion adds stock
      invalidateProductRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Cancel production mutation with optimistic updates
 */
export function useCancelProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductionBatchWithRelations,
    Error,
    { batchId: string; data: CancelProductionInput },
    {
      previousBatch: ProductionBatchWithRelations | undefined;
      previousQueries: Array<[readonly unknown[], ProductionBatchesResponse | undefined]>;
    }
  >({
    mutationFn: ({ batchId, data }) => cancelProduction(storeId, batchId, data),
    onMutate: async ({ batchId, data }) => {
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.detail(storeId, batchId) });

      const previousBatch = queryClient.getQueryData<ProductionBatchWithRelations>(
        productionBatchKeys.detail(storeId, batchId)
      );
      const previousQueries = queryClient.getQueriesData<ProductionBatchesResponse>({
        queryKey: productionBatchKeys.lists(storeId),
      });

      // Optimistically update detail
      if (previousBatch) {
        queryClient.setQueryData<ProductionBatchWithRelations>(
          productionBatchKeys.detail(storeId, batchId),
          {
            ...previousBatch,
            status: "CANCELLED",
            notes: data.reason
              ? `${previousBatch.notes ? previousBatch.notes + "\n" : ""}Cancelled: ${data.reason}`
              : previousBatch.notes,
            updatedAt: new Date(),
          } as ProductionBatchWithRelations
        );
      }

      // Optimistically update lists
      queryClient.setQueriesData<ProductionBatchesResponse>(
        { queryKey: productionBatchKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.batches) return oldData;
          return {
            ...oldData,
            batches: oldData.batches.map((b) =>
              b.id === batchId
                ? ({
                    ...b,
                    status: "CANCELLED",
                    notes: data.reason
                      ? `${b.notes ? b.notes + "\n" : ""}Cancelled: ${data.reason}`
                      : b.notes,
                    updatedAt: new Date(),
                  } as ProductionBatchWithRelations)
                : b
            ),
          };
        }
      );

      return { previousBatch, previousQueries };
    },
    onError: (error, vars, context) => {
      if (context?.previousBatch) {
        queryClient.setQueryData(
          productionBatchKeys.detail(storeId, vars.batchId),
          context.previousBatch
        );
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedBatch) => {
      queryClient.setQueryData(productionBatchKeys.detail(storeId, updatedBatch.id), updatedBatch);
      // Use non-blocking invalidation helper
      invalidateMaterialRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Delete production batch mutation with optimistic updates
 */
export function useDeleteProductionBatch(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    string,
    { previousQueries: Array<[readonly unknown[], ProductionBatchesResponse | undefined]> }
  >({
    mutationFn: (batchId: string) => deleteProductionBatch(storeId, batchId),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: productionBatchKeys.lists(storeId) });

      const previousQueries = queryClient.getQueriesData<ProductionBatchesResponse>({
        queryKey: productionBatchKeys.lists(storeId),
      });

      // Optimistically remove from lists
      queryClient.setQueriesData<ProductionBatchesResponse>(
        { queryKey: productionBatchKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.batches) return oldData;
          return {
            ...oldData,
            batches: oldData.batches.filter((b) => b.id !== deletedId),
            total: Math.max(0, oldData.total - 1),
          };
        }
      );

      return { previousQueries };
    },
    onError: (error, deletedId, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: productionBatchKeys.detail(storeId, deletedId) });
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
    },
  });
}
