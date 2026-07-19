import { QueryClient } from "@tanstack/react-query";
import { materialKeys } from "@/features/dashboard/data/materials/hooks/use-materials";
import { MaterialFilterInput } from "@/lib/validation/inventory.schemas";
import {
  productKeys,
  ProductFilterInput,
} from "@/features/dashboard/data/products/hooks/use-products";
import { recipeKeys } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import { RecipeFilterInput } from "@/lib/validation/inventory.schemas";
import {
  supplierKeys,
  SupplierFilterInput,
} from "@/features/dashboard/data/suppliers/hooks/use-suppliers";

/**
 * Prefetch utilities for data sections
 * These functions prefetch data when user hovers over tabs or navigation links
 * to improve perceived performance
 */

/**
 * Prefetch materials for a store
 */
export async function prefetchMaterials(
  queryClient: QueryClient,
  storeId: string,
  filters?: MaterialFilterInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: materialKeys.list(storeId, filters),
    queryFn: async () => {
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
        throw new Error("Failed to prefetch materials");
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 20 * 1000, // 20 seconds
  });
}

/**
 * Prefetch products for a store
 */
export async function prefetchProducts(
  queryClient: QueryClient,
  storeId: string,
  filters?: ProductFilterInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: productKeys.list(storeId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);
      if (filters?.skip !== undefined) params.append("skip", filters.skip.toString());
      if (filters?.take !== undefined) params.append("take", filters.take.toString());

      const response = await fetch(`/api/stores/${storeId}/products?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to prefetch products");
      }

      return response.json();
    },
    staleTime: 20 * 1000, // 20 seconds
  });
}

/**
 * Prefetch recipes for a store
 */
export async function prefetchRecipes(
  queryClient: QueryClient,
  storeId: string,
  filters?: RecipeFilterInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: recipeKeys.list(storeId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);
      if (filters?.skip !== undefined) params.append("skip", filters.skip.toString());
      if (filters?.take !== undefined) params.append("take", filters.take.toString());

      const response = await fetch(`/api/stores/${storeId}/recipes?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to prefetch recipes");
      }

      return response.json();
    },
    staleTime: 20 * 1000, // 20 seconds
  });
}

/**
 * Prefetch suppliers for a store
 */
export async function prefetchSuppliers(
  queryClient: QueryClient,
  storeId: string,
  filters?: SupplierFilterInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: supplierKeys.list(storeId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);
      if (filters?.skip !== undefined) params.append("skip", filters.skip.toString());
      if (filters?.take !== undefined) params.append("take", filters.take.toString());

      const response = await fetch(
        `/api/stores/${storeId}/suppliers${params.toString() ? `?${params.toString()}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to prefetch suppliers");
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (suppliers don't change often)
  });
}
