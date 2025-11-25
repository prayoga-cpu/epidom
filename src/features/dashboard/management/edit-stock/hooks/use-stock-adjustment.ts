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
      previousMaterials?: MaterialsResponse;
      previousProducts?: ProductsResponse;
      previousRecipes?: RecipesResponse;
    }
  >({
    mutationFn: (input) => adjustStock(storeId, input),
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["materials", storeId] });
      await queryClient.cancelQueries({ queryKey: ["products", storeId] });
      await queryClient.cancelQueries({ queryKey: recipeKeys.lists(storeId) });

      // Snapshot previous values for rollback
      const previousMaterials = queryClient.getQueryData<MaterialsResponse>([
        "materials",
        storeId,
        "list",
      ]);
      const previousProducts = queryClient.getQueryData<ProductsResponse>([
        "products",
        storeId,
        "list",
      ]);
      const previousRecipes = queryClient.getQueryData<RecipesResponse>(recipeKeys.list(storeId));

      // Calculate new stock optimistically
      if (input.materialId && previousMaterials) {
        const materialsData = previousMaterials;
        const material = materialsData.materials?.find((m) => m.id === input.materialId);

        if (material) {
          const currentStock = Number(material.currentStock) || 0;
          const adjustment = input.adjustmentType === "IN" ? input.quantity : -input.quantity;
          const newStock = currentStock + adjustment;

          // Optimistically update materials cache
          queryClient.setQueryData<MaterialsResponse>(["materials", storeId, "list"], {
            ...materialsData,
            materials: materialsData.materials.map((m) =>
              m.id === input.materialId ? { ...m, currentStock: newStock as unknown as Decimal } : m
            ),
          });

          // Optimistically update recipes cache (material stock in ingredients)
          if (previousRecipes) {
            const recipesData = previousRecipes;
            queryClient.setQueryData<RecipesResponse>(recipeKeys.list(storeId), {
              ...recipesData,
              recipes: recipesData.recipes.map((recipe) => ({
                ...recipe,
                ingredients: recipe.ingredients.map((ing) =>
                  ing.materialId === input.materialId
                    ? {
                        ...ing,
                        material: {
                          ...ing.material,
                          currentStock: newStock,
                        },
                      }
                    : ing
                ),
              })),
            });
          }
        }
      }

      // Similar for products
      if (input.productId && previousProducts) {
        const productsData = previousProducts;
        const product = productsData.products?.find((p) => p.id === input.productId);

        if (product) {
          const currentStock = Number(product.currentStock) || 0;
          const adjustment = input.adjustmentType === "IN" ? input.quantity : -input.quantity;
          const newStock = currentStock + adjustment;

          queryClient.setQueryData<ProductsResponse>(["products", storeId, "list"], {
            ...productsData,
            products: productsData.products.map((p) =>
              p.id === input.productId ? { ...p, currentStock: newStock as unknown as Decimal } : p
            ),
          });
        }
      }

      return { previousMaterials, previousProducts, previousRecipes };
    },
    onError: (error, input, context) => {
      // Rollback optimistic updates on error
      if (context?.previousMaterials) {
        queryClient.setQueryData(["materials", storeId, "list"], context.previousMaterials);
      }
      if (context?.previousProducts) {
        queryClient.setQueryData(["products", storeId, "list"], context.previousProducts);
      }
      if (context?.previousRecipes) {
        queryClient.setQueryData(recipeKeys.list(storeId), context.previousRecipes);
      }
    },
    onSuccess: async (response, input) => {
      // Replace optimistic data with real server data
      const realStock = response.movement.balanceAfter;

      if (input.materialId && response.material) {
        // Update materials cache with real data
        const materialsData = queryClient.getQueryData<MaterialsResponse>([
          "materials",
          storeId,
          "list",
        ]);
        if (materialsData) {
          queryClient.setQueryData<MaterialsResponse>(["materials", storeId, "list"], {
            ...materialsData,
            materials: materialsData.materials.map((m) =>
              m.id === input.materialId
                ? { ...m, currentStock: realStock as unknown as Decimal }
                : m
            ),
          });
        }

        // Update recipes cache with real data
        const recipesData = queryClient.getQueryData<RecipesResponse>(recipeKeys.list(storeId));
        if (recipesData) {
          queryClient.setQueryData<RecipesResponse>(recipeKeys.list(storeId), {
            ...recipesData,
            recipes: recipesData.recipes.map((recipe) => ({
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
          });
        }
      }

      if (input.productId && response.product) {
        const productsData = queryClient.getQueryData<ProductsResponse>([
          "products",
          storeId,
          "list",
        ]);
        if (productsData) {
          queryClient.setQueryData<ProductsResponse>(["products", storeId, "list"], {
            ...productsData,
            products: productsData.products.map((p) =>
              p.id === input.productId ? { ...p, currentStock: realStock as unknown as Decimal } : p
            ),
          });
        }
      }

      // Invalidate related queries (non-blocking)
      await invalidateMaterialRelatedQueries(queryClient, storeId, true);

      queryClient.invalidateQueries({
        queryKey: ["production-batches", storeId],
        exact: false,
        refetchType: "active",
      });

      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
      });
    },
  });
}
