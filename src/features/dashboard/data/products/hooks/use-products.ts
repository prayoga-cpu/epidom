import type { SerializeDecimal } from "@/types/prisma";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateProductInput, UpdateProductInput } from "@/lib/validation/inventory.schemas";
import type { Product } from "@prisma/client";
import type { ProductWithRelations } from "@/lib/repositories/product.repository";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import { invalidateProductRelatedQueries } from "@/lib/utils/cache-helpers";

// Re-export for convenience
export type { Product };

export interface ProductsResponse {
  products: SerializeDecimal<ProductWithRelations>[];
  total: number;
}

export interface ProductFilterInput {
  search?: string;
  category?: string;
  sortBy?:
    | "name"
    | "sku"
    | "currentStock"
    | "costPrice"
    | "sellingPrice"
    | "createdAt"
    | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

// Query keys for cache management (DRY principle)
export const productKeys = {
  all: (storeId: string) => ["products", storeId] as const,
  lists: (storeId: string) => [...productKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: ProductFilterInput) =>
    [...productKeys.lists(storeId), normalizeFilters(filters)] as const,
  details: (storeId: string) => [...productKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...productKeys.details(storeId), id] as const,
};

// API Functions
async function fetchProducts(
  storeId: string,
  filters: ProductFilterInput
): Promise<ProductsResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
  if (filters.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters.take !== undefined) params.append("take", filters.take.toString());

  const response = await fetch(`/api/stores/${storeId}/products?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to fetch products");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function fetchProductById(storeId: string, productId: string): Promise<SerializeDecimal<Product>> {
  const response = await fetch(`/api/stores/${storeId}/products/${productId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to fetch product");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function createProduct(storeId: string, data: CreateProductInput): Promise<SerializeDecimal<Product>> {
  const response = await fetch(`/api/stores/${storeId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to create product");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function updateProduct(
  storeId: string,
  productId: string,
  data: UpdateProductInput
): Promise<SerializeDecimal<Product>> {
  const response = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to update product");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function deleteProduct(storeId: string, productId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete product");
  }
}

async function bulkDeleteProducts(
  storeId: string,
  productIds: string[]
): Promise<{ deletedCount: number }> {
  const response = await fetch(`/api/stores/${storeId}/products/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: productIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete products");
  }

  return response.json();
}

async function exportProducts(storeId: string, filters: ProductFilterInput): Promise<void> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

  const response = await fetch(`/api/stores/${storeId}/products/export?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();

    // Handle 403 Forbidden (subscription feature locked)
    if (response.status === 403 && error.code === "SUBSCRIPTION_FEATURE_LOCKED") {
      const { createSubscriptionError } = await import("@/types/errors");
      const customError = createSubscriptionError(
        error.message || "Export feature is only available in Pro and Enterprise plans",
        true
      );
      (customError as any).status = 403;
      throw customError;
    }

    throw new Error(error.error || "Failed to export products");
  }

  // Download CSV file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// React Query Hooks

/**
 * Fetch all products with filters
 * Real-time enabled: Polls every 30 seconds when tab is active
 */
export function useProducts(
  storeId: string,
  filters: ProductFilterInput,
  initialData?: ProductsResponse
) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: productKeys.list(storeId, normalizedFilters),
    queryFn: () => fetchProducts(storeId, normalizedFilters || filters),
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
 * Fetch single product by ID
 */
export function useProduct(storeId: string, productId: string | null) {
  return useQuery({
    queryKey: productKeys.detail(storeId, productId!),
    queryFn: () => fetchProductById(storeId, productId!),
    enabled: !!storeId && !!productId,
  });
}

/**
 * Create product mutation
 */
export function useCreateProduct(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductInput) => createProduct(storeId, data),
    onSuccess: (newProduct) => {
      // Optimistic update: Add new product to all product list caches immediately
      // This ensures UI updates instantly without waiting for refetch
      queryClient.setQueriesData<ProductsResponse>(
        { queryKey: productKeys.lists(storeId), exact: false },
        (oldData) => {
          // Validate oldData structure before updating
          if (
            oldData &&
            typeof oldData === "object" &&
            "products" in oldData &&
            Array.isArray(oldData.products) &&
            typeof oldData.total === "number"
          ) {
            // Safe to update: oldData has correct structure
            // Check if product already exists to avoid duplicates (e.g. from background refetch)
            if (oldData.products.some((p) => p.id === newProduct.id)) {
              return oldData;
            }

            return {
              products: [...oldData.products, newProduct],
              total: oldData.total + 1,
            };
          }
          // If oldData is invalid or missing, return undefined to trigger refetch
          return undefined;
        }
      );

      // Invalidate all product queries to ensure consistency
      // Use immediate: true to ensure active queries refetch
      invalidateProductRelatedQueries(queryClient, storeId, true);
    },
  });
}

/**
 * Update product mutation with optimistic updates
 * Real-time: Updates UI immediately, syncs with server in background
 */
export function useUpdateProduct(storeId: string, productId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    SerializeDecimal<ProductWithRelations>,
    Error,
    UpdateProductInput,
    {
      previousProduct: SerializeDecimal<ProductWithRelations> | undefined;
      previousQueries: Array<[readonly unknown[], ProductsResponse | undefined]>;
    }
  >({
    mutationFn: (data) => updateProduct(storeId, productId, data),
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: productKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: productKeys.detail(storeId, productId) });

      // Snapshot previous values for rollback
      const previousProduct = queryClient.getQueryData<SerializeDecimal<ProductWithRelations>>(
        productKeys.detail(storeId, productId)
      );
      const previousQueries = queryClient.getQueriesData<ProductsResponse>({
        queryKey: productKeys.lists(storeId),
      });

      // Optimistically update detail cache
      if (previousProduct) {
        queryClient.setQueryData<SerializeDecimal<Product>>(productKeys.detail(storeId, productId), {
          ...previousProduct,
          ...newData,
          updatedAt: new Date(),
        } as SerializeDecimal<Product>);
      }

      // Optimistically update all list caches
      queryClient.setQueriesData<ProductsResponse>(
        { queryKey: productKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.products) return oldData;
          return {
            ...oldData,
            products: oldData.products.map((p) =>
              p.id === productId
                ? ({
                    ...p,
                    ...newData,
                    updatedAt: new Date(),
                  } as SerializeDecimal<Product>)
                : p
            ),
          };
        }
      );

      return { previousProduct, previousQueries };
    },
    onError: (error, newData, context) => {
      // Rollback optimistic update on error
      if (context?.previousProduct) {
        queryClient.setQueryData(productKeys.detail(storeId, productId), context.previousProduct);
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedProduct) => {
      // Replace optimistic data with real server data
      queryClient.setQueryData(productKeys.detail(storeId, productId), updatedProduct);

      // Update in all list caches with real data
      queryClient.setQueriesData<ProductsResponse>(
        { queryKey: productKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.products) return oldData;
          return {
            ...oldData,
            products: oldData.products.map((p) => (p.id === productId ? updatedProduct : p)),
          };
        }
      );

      // Non-blocking cache invalidation for related queries
      invalidateProductRelatedQueries(queryClient, storeId, false, true);
    },
  });
}

/**
 * Delete product mutation with optimistic updates
 * Real-time: Removes from UI immediately, syncs with server in background
 */
export function useDeleteProduct(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    string,
    { previousQueries: Array<[readonly unknown[], ProductsResponse | undefined]> }
  >({
    mutationFn: (productId) => deleteProduct(storeId, productId),
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: productKeys.lists(storeId) });

      // Snapshot previous queries
      const previousQueries = queryClient.getQueriesData<ProductsResponse>({
        queryKey: productKeys.lists(storeId),
      });

      // Optimistically remove from all matching caches
      queryClient.setQueriesData<ProductsResponse>(
        { queryKey: productKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.products) return oldData;
          return {
            ...oldData,
            products: oldData.products.filter((p) => p.id !== deletedId),
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
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: productKeys.detail(storeId, deletedId) });

      // Non-blocking cache invalidation for related queries
      invalidateProductRelatedQueries(queryClient, storeId, false, true);
    },
  });
}

/**
 * Bulk delete products mutation
 */
export function useBulkDeleteProducts(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productIds: string[]) => bulkDeleteProducts(storeId, productIds),
    onSuccess: (_, productIds) => {
      // Remove all deleted items from cache
      productIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: productKeys.detail(storeId, id) });
      });
      // Non-blocking cache invalidation: Only invalidate products immediately
      // Other queries (alerts) will sync in background
      invalidateProductRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Export products
 */
export function useExportProducts() {
  return useMutation({
    mutationFn: ({ storeId, filters }: { storeId: string; filters: ProductFilterInput }) =>
      exportProducts(storeId, filters),
  });
}
