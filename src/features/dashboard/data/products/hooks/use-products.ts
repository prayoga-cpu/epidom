import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateProductInput, UpdateProductInput } from "@/lib/validation/inventory.schemas";
import type { Product } from "@prisma/client";
import { invalidateProductRelatedQueries } from "@/lib/react-query/cache-utils";
import type { ApiSuccessResponse } from "@/types/api/responses";
import { DEFAULT_QUERY_OPTIONS } from "@/lib/react-query/constants";
import { buildQueryParams } from "@/lib/utils/query-params";
import { fetchWithErrorHandling } from "@/lib/api/client";
import { exportToCSV } from "@/lib/utils/export";

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

// Query Key Factory
export const productKeys = {
  all: (storeId: string) => ["products", storeId] as const,
  lists: (storeId: string) => [...productKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: ProductFilterInput) =>
    [...productKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...productKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...productKeys.details(storeId), id] as const,
};

// API Functions
async function fetchProducts(
  storeId: string,
  filters: ProductFilterInput
): Promise<ProductsResponse> {
  const params = buildQueryParams(filters as Record<string, unknown>);
  const url = `/api/stores/${storeId}/products${params.toString() ? `?${params.toString()}` : ""}`;
  return fetchWithErrorHandling<ProductsResponse>(url);
}

async function fetchProductById(storeId: string, productId: string): Promise<Product> {
  return fetchWithErrorHandling<Product>(`/api/stores/${storeId}/products/${productId}`);
}

async function createProduct(storeId: string, data: CreateProductInput): Promise<Product> {
  return fetchWithErrorHandling<Product>(`/api/stores/${storeId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function updateProduct(
  storeId: string,
  productId: string,
  data: UpdateProductInput
): Promise<Product> {
  return fetchWithErrorHandling<Product>(`/api/stores/${storeId}/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function deleteProduct(storeId: string, productId: string): Promise<void> {
  await fetchWithErrorHandling<void>(`/api/stores/${storeId}/products/${productId}`, {
    method: "DELETE",
  });
}

async function bulkDeleteProducts(
  storeId: string,
  productIds: string[]
): Promise<{ deletedCount: number }> {
  return fetchWithErrorHandling<{ deletedCount: number }>(`/api/stores/${storeId}/products/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: productIds }),
  });
}

async function exportProducts(storeId: string, filters: ProductFilterInput): Promise<void> {
  await exportToCSV(`/api/stores/${storeId}/products/export`, "export", "products", filters as Record<string, unknown>);
}

// React Query Hooks

/**
 * Fetch all products with filters
 */
export function useProducts(storeId: string, filters: ProductFilterInput) {
  return useQuery({
    queryKey: productKeys.list(storeId, filters),
    queryFn: () => fetchProducts(storeId, filters),
    enabled: !!storeId,
    ...DEFAULT_QUERY_OPTIONS.inventory,
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
    staleTime: 60 * 1000, // 1 minute - data considered fresh for 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes - cache kept for 5 minutes after unmount
  });
}

/**
 * Create product mutation
 */
export function useCreateProduct(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductInput) => createProduct(storeId, data),
    onSuccess: async () => {
      await invalidateProductRelatedQueries(queryClient, storeId);
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
    onSuccess: async () => {
      await invalidateProductRelatedQueries(queryClient, storeId, productId);
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
    onSuccess: async () => {
      await invalidateProductRelatedQueries(queryClient, storeId);
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
    onSuccess: async () => {
      await invalidateProductRelatedQueries(queryClient, storeId);
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
