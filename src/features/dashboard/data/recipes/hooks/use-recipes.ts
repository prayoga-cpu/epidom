import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateRecipeFormInput,
  UpdateRecipeFormInput,
  RecipeFilterInput,
} from "@/lib/validation/inventory.schemas";
import { invalidateRecipeRelatedQueries } from "@/lib/react-query/cache-utils";
import { DEFAULT_QUERY_OPTIONS } from "@/lib/react-query/constants";
import { buildQueryParams } from "@/lib/utils/query-params";
import { fetchWithErrorHandling } from "@/lib/api/client";
import { exportToCSV } from "@/lib/utils/export";

// Types
export interface RecipeWithIngredients {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  productionTimeMinutes: number;
  instructions: string | null;
  costPerBatch: number;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
  ingredients: Array<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: number;
    unit: string;
    notes: string | null;
    material: {
      id: string;
      name: string;
      unit: string;
      unitCost: number;
      currentStock: number;
    };
  }>;
  products?: Array<{
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    unit: string;
    currentStock: number;
    minStock: number;
    maxStock: number;
    costPrice: number;
    sellingPrice: number;
  }>;
}

export interface RecipesResponse {
  recipes: RecipeWithIngredients[];
  total: number;
}

// Query Key Factory
export const recipeKeys = {
  all: (storeId: string) => ["recipes", storeId] as const,
  lists: (storeId: string) => [...recipeKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: RecipeFilterInput) =>
    [...recipeKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...recipeKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...recipeKeys.details(storeId), id] as const,
};

// API Functions
async function fetchRecipes(storeId: string, filters: RecipeFilterInput): Promise<RecipesResponse> {
  const params = buildQueryParams(filters as Record<string, unknown>);
  const url = `/api/stores/${storeId}/recipes${params.toString() ? `?${params.toString()}` : ""}`;
  // Use fetchWithErrorHandling to properly unwrap ApiSuccessResponse wrapper
  return fetchWithErrorHandling<RecipesResponse>(url);
}

async function fetchRecipeById(storeId: string, recipeId: string): Promise<RecipeWithIngredients> {
  return fetchWithErrorHandling<RecipeWithIngredients>(`/api/stores/${storeId}/recipes/${recipeId}`);
}

async function createRecipe(
  storeId: string,
  data: CreateRecipeFormInput
): Promise<RecipeWithIngredients> {
  return fetchWithErrorHandling<RecipeWithIngredients>(`/api/stores/${storeId}/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function updateRecipe(
  storeId: string,
  recipeId: string,
  data: UpdateRecipeFormInput
): Promise<RecipeWithIngredients> {
  return fetchWithErrorHandling<RecipeWithIngredients>(`/api/stores/${storeId}/recipes/${recipeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function deleteRecipe(storeId: string, recipeId: string): Promise<void> {
  await fetchWithErrorHandling<void>(`/api/stores/${storeId}/recipes/${recipeId}`, {
    method: "DELETE",
  });
}

async function bulkDeleteRecipes(storeId: string, recipeIds: string[]): Promise<{ count: number }> {
  return fetchWithErrorHandling<{ count: number }>(`/api/stores/${storeId}/recipes/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: recipeIds }),
  });
}

async function duplicateRecipe(
  storeId: string,
  recipeId: string,
  newName: string
): Promise<RecipeWithIngredients> {
  return fetchWithErrorHandling<RecipeWithIngredients>(
    `/api/stores/${storeId}/recipes/${recipeId}/duplicate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newName }),
    }
  );
}

async function exportRecipes(storeId: string, filters: RecipeFilterInput): Promise<void> {
  await exportToCSV(`/api/stores/${storeId}/recipes/export`, "export", "recipes", filters as Record<string, unknown>);
}

// React Query Hooks

/**
 * Fetch all recipes with filters
 */
export function useRecipes(storeId: string, filters: RecipeFilterInput) {
  return useQuery({
    queryKey: recipeKeys.list(storeId, filters),
    queryFn: () => fetchRecipes(storeId, filters),
    enabled: !!storeId,
    ...DEFAULT_QUERY_OPTIONS.inventory,
  });
}

/**
 * Fetch single recipe by ID
 */
export function useRecipe(storeId: string, recipeId: string | null) {
  return useQuery({
    queryKey: recipeKeys.detail(storeId, recipeId!),
    queryFn: () => fetchRecipeById(storeId, recipeId!),
    enabled: !!storeId && !!recipeId,
    ...DEFAULT_QUERY_OPTIONS.inventory,
  });
}

/**
 * Create recipe mutation
 */
export function useCreateRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeFormInput) => createRecipe(storeId, data),
    onSuccess: async (newRecipe) => {
      // Invalidate and refetch all recipe queries
      await invalidateRecipeRelatedQueries(queryClient, storeId, newRecipe.id);

      // Additional safety: explicitly refetch all recipe list queries
      // This ensures UI updates even if query keys don't match exactly
      await queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "recipes" &&
            key[1] === storeId
          );
        },
      });
    },
  });
}

/**
 * Update recipe mutation
 */
export function useUpdateRecipe(storeId: string, recipeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRecipeFormInput) => updateRecipe(storeId, recipeId, data),
    onSuccess: async () => {
      await invalidateRecipeRelatedQueries(queryClient, storeId, recipeId);
    },
  });
}

/**
 * Delete recipe mutation
 */
export function useDeleteRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(storeId, recipeId),
    onSuccess: async () => {
      await invalidateRecipeRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Bulk delete recipes mutation
 */
export function useBulkDeleteRecipes(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeIds: string[]) => bulkDeleteRecipes(storeId, recipeIds),
    onSuccess: async () => {
      await invalidateRecipeRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Duplicate recipe mutation
 */
export function useDuplicateRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, newName }: { recipeId: string; newName: string }) =>
      duplicateRecipe(storeId, recipeId, newName),
    onSuccess: async () => {
      await invalidateRecipeRelatedQueries(queryClient, storeId);
    },
  });
}

/**
 * Export recipes (not a hook, but a helper function)
 */
export function useExportRecipes() {
  return useMutation({
    mutationFn: ({ storeId, filters }: { storeId: string; filters: RecipeFilterInput }) =>
      exportRecipes(storeId, filters),
  });
}
