import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateMaterialRelatedQueries } from "@/lib/utils/cache-helpers";
import { stockMovementKeys } from "./use-stock-movements";
import { recipeKeys } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { Material, Product } from "@prisma/client";

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
async function adjustStock(storeId: string, input: StockAdjustmentInput): Promise<StockAdjustmentResponse> {
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
 * Hook for adjusting stock with cache invalidation
 */
export function useStockAdjustment(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<StockAdjustmentResponse, Error, StockAdjustmentInput>({
    mutationFn: (input) => adjustStock(storeId, input),
    onSuccess: async (response, input) => {
      // Optimistic update: Immediately update material stock in recipes cache
      // This ensures production tab sees updated stock instantly without waiting for refetch
      if (input.materialId && response.material) {
        const newStock = response.movement.balanceAfter;

        // Update all recipe queries that contain this material
        queryClient.setQueriesData<{ recipes: RecipeWithIngredients[]; total: number }>(
          { queryKey: recipeKeys.lists(storeId), exact: false },
          (oldData) => {
            if (!oldData || !Array.isArray(oldData.recipes)) {
              return oldData;
            }

            // Update material stock in all recipes that use this material
            const updatedRecipes = oldData.recipes.map((recipe) => {
              const hasMaterial = recipe.ingredients.some(
                (ing) => ing.materialId === input.materialId
              );

              if (!hasMaterial) {
                return recipe;
              }

              // Update material stock in ingredients
              const updatedIngredients = recipe.ingredients.map((ing) => {
                if (ing.materialId === input.materialId) {
                  return {
                    ...ing,
                    material: {
                      ...ing.material,
                      currentStock: newStock,
                    },
                  };
                }
                return ing;
              });

              return {
                ...recipe,
                ingredients: updatedIngredients,
              };
            });

            return {
              ...oldData,
              recipes: updatedRecipes,
            };
          }
        );
      }

      // Invalidate all related queries immediately for real-time updates
      // This ensures production tab sees updated stock immediately
      await invalidateMaterialRelatedQueries(queryClient, storeId, true);

      // Also invalidate production batches (they contain material stock data)
      queryClient.invalidateQueries({
        queryKey: ["production-batches", storeId],
        exact: false,
        refetchType: "active", // Refetch active queries immediately
      });

      // Also invalidate stock movements specifically
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
      });
    },
  });
}

