import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateMaterialRelatedQueries } from "@/lib/utils/cache-helpers";
import { stockMovementKeys } from "./use-stock-movements";
import { recipeKeys } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type {
  RecipeWithIngredients,
  RecipesResponse,
} from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { Material, Product } from "@prisma/client";
import type { MaterialsResponse } from "@/features/dashboard/data/materials/hooks/use-materials";
import type { ProductsResponse } from "@/features/dashboard/data/products/hooks/use-products";
import { Decimal } from "@prisma/client/runtime/library";

export interface StockAdjustmentInput {
  materialId?: string;
  productId?: string;
  adjustmentType: "IN" | "OUT";
  quantity: number;
  reason: string;
  notes?: string;
  referenceId?: string;
}

interface StockAdjustmentResponse {
  material?: Material;
  product?: Product;
  movement: {
    id: string;
    type: string;
    quantity: number;
    balanceAfter: number;
    reason?: string;
    notes?: string;
    referenceId?: string;
  };
}

/**
 * Hook for adjusting stock
 */
async function adjustStock(
  storeId: string,
  input: StockAdjustmentInput
): Promise<StockAdjustmentResponse> {
  const response = await fetch(`/api/stores/${storeId}/stock/adjust`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to adjust stock");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Hook for adjusting stock with optimistic updates
 * Real-time: Updates stock instantly in all caches, syncs with server in background
 */
export function useStockAdjustment(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    StockAdjustmentResponse,
    Error,
    StockAdjustmentInput,
    {
      previousMaterialQueries: Array<[readonly unknown[], MaterialsResponse | undefined]>;
      previousProductQueries: Array<[readonly unknown[], ProductsResponse | undefined]>;
      previousRecipeQueries: Array<[readonly unknown[], RecipesResponse | undefined]>;
    }
  >({
    mutationFn: (input) => adjustStock(storeId, input),
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["materials", storeId] });
      await queryClient.cancelQueries({ queryKey: ["products", storeId] });
      await queryClient.cancelQueries({ queryKey: recipeKeys.lists(storeId) });

      // Snapshot previous queries
      const previousMaterialQueries = queryClient.getQueriesData<MaterialsResponse>({
        queryKey: ["materials", storeId, "list"],
      });
      const previousProductQueries = queryClient.getQueriesData<ProductsResponse>({
        queryKey: ["products", storeId, "list"],
      });
      const previousRecipeQueries = queryClient.getQueriesData<RecipesResponse>({
        queryKey: recipeKeys.lists(storeId),
      });

      // Calculate new stock optimistically
      if (input.materialId) {
        const adjustment = input.adjustmentType === "IN" ? input.quantity : -input.quantity;

        // Optimistically update all materials caches
        queryClient.setQueriesData<MaterialsResponse>(
          { queryKey: ["materials", storeId, "list"] },
          (oldData) => {
            if (!oldData || !oldData.materials) return oldData;
            return {
              ...oldData,
              materials: oldData.materials.map((m) => {
                if (m.id === input.materialId) {
                  const currentStock = Number(m.currentStock) || 0;
                  return { ...m, currentStock: (currentStock + adjustment) as unknown as Decimal };
                }
                return m;
              }),
            };
          }
        );

        // Optimistically update all recipes caches (material stock in ingredients)
        queryClient.setQueriesData<RecipesResponse>(
          { queryKey: recipeKeys.lists(storeId) },
          (oldData) => {
            if (!oldData || !oldData.recipes) return oldData;
            return {
              ...oldData,
              recipes: oldData.recipes.map((recipe) => ({
                ...recipe,
                ingredients: recipe.ingredients.map((ing) => {
                  if (ing.materialId === input.materialId) {
                    const currentStock = Number(ing.material.currentStock) || 0;
                    return {
                      ...ing,
                      material: {
                        ...ing.material,
                        currentStock: currentStock + adjustment,
                      },
                    };
                  }
                  return ing;
                }),
              })),
            };
          }
        );
      }

      // Similar for products
      if (input.productId) {
        const adjustment = input.adjustmentType === "IN" ? input.quantity : -input.quantity;

        queryClient.setQueriesData<ProductsResponse>(
          { queryKey: ["products", storeId, "list"] },
          (oldData) => {
            if (!oldData || !oldData.products) return oldData;
            return {
              ...oldData,
              products: oldData.products.map((p) => {
                if (p.id === input.productId) {
                  const currentStock = Number(p.currentStock) || 0;
                  return { ...p, currentStock: (currentStock + adjustment) as unknown as Decimal };
                }
                return p;
              }),
            };
          }
        );
      }

      return { previousMaterialQueries, previousProductQueries, previousRecipeQueries };
    },
    onError: (error, input, context) => {
      // Rollback optimistic updates on error
      if (context?.previousMaterialQueries) {
        context.previousMaterialQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousProductQueries) {
        context.previousProductQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousRecipeQueries) {
        context.previousRecipeQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: async (response, input) => {
      // Replace optimistic data with real server data
      const realStock = response.movement.balanceAfter;

      if (input.materialId && response.material) {
        // Update all materials caches with real data
        queryClient.setQueriesData<MaterialsResponse>(
          { queryKey: ["materials", storeId, "list"] },
          (oldData) => {
            if (!oldData || !oldData.materials) return oldData;
            return {
              ...oldData,
              materials: oldData.materials.map((m) =>
                m.id === input.materialId
                  ? { ...m, currentStock: realStock as unknown as Decimal }
                  : m
              ),
            };
          }
        );

        // Update all recipes caches with real data
        queryClient.setQueriesData<RecipesResponse>(
          { queryKey: recipeKeys.lists(storeId) },
          (oldData) => {
            if (!oldData || !oldData.recipes) return oldData;
            return {
              ...oldData,
              recipes: oldData.recipes.map((recipe) => ({
                ...recipe,
                ingredients: recipe.ingredients.map((ing) =>
                  ing.materialId === input.materialId
                    ? {
                        ...ing,
                        material: {
                          ...ing.material,
                          currentStock: realStock,
                        },
                      }
                    : ing
                ),
              })),
            };
          }
        );
      }

      if (input.productId && response.product) {
        // Update all products caches with real data
        queryClient.setQueriesData<ProductsResponse>(
          { queryKey: ["products", storeId, "list"] },
          (oldData) => {
            if (!oldData || !oldData.products) return oldData;
            return {
              ...oldData,
              products: oldData.products.map((p) =>
                p.id === input.productId
                  ? { ...p, currentStock: realStock as unknown as Decimal }
                  : p
              ),
            };
          }
        );
      }

      // Invalidate related queries (non-blocking)
      // Use false to trigger "smart" invalidation: immediate for active queries, background for others
      invalidateMaterialRelatedQueries(queryClient, storeId, false);
    },
  });
}
