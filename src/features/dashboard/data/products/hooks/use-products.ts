import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateProductInput, UpdateProductInput } from "@/lib/validation/inventory.schemas";
import type { Product } from "@prisma/client";
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";

// Re-export for convenience
export type { Product };

export interface ProductsResponse {
  products: Product[];
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
    throw new Error(error.error || "Failed to fetch products");
  }

  return response.json();
}

async function fetchProductById(storeId: string, productId: string): Promise<Product> {
  const response = await fetch(`/api/stores/${storeId}/products/${productId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch product");
  }

  return response.json();
}

async function createProduct(storeId: string, data: CreateProductInput): Promise<Product> {
  const response = await fetch(`/api/stores/${storeId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create product");
  }

  return response.json();
}

async function updateProduct(
  storeId: string,
  productId: string,
  data: UpdateProductInput
): Promise<Product> {
  const response = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update product");
  }

  return response.json();
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
export function useProducts(storeId: string, filters: ProductFilterInput) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: ["products", storeId, normalizedFilters],
    queryFn: () => fetchProducts(storeId, normalizedFilters || filters),
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
 * Fetch single product by ID
 */
export function useProduct(storeId: string, productId: string | null) {
  return useQuery({
    queryKey: ["products", storeId, productId],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      // Invalidate product usage cache (product count has changed)
      queryClient.invalidateQueries({ queryKey: ["product-usage", storeId] });
      // Invalidate alerts (new product may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (initial stock movement may have been created)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
    },
  });
}

/**
 * Update product mutation
 */
export function useUpdateProduct(storeId: string, productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProductInput) => updateProduct(storeId, productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId, productId] });
      // Invalidate alerts (stock changes may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (new movement may have been created)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
    },
  });
}

/**
 * Delete product mutation
 */
export function useDeleteProduct(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => deleteProduct(storeId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      // Invalidate alerts (deleted product may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      // Invalidate alerts (deleted products may affect alerts)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
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
