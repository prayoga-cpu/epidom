import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateRecipeFormInput,
  UpdateRecipeFormInput,
  RecipeFilterInput,
} from "@/lib/validation/inventory.schemas";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import { invalidateRecipeRelatedQueries } from "@/lib/utils/cache-helpers";

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
  recipeProducts?: Array<{
    id: string;
    recipeId: string;
    productId: string;
    isDefault: boolean;
    product: {
      id: string;
      name: string;
      sku: string;
      category: string | null;
      unit: string;
      currentStock: number;
      minStock: number;
      maxStock: number;
      costPrice: number;
      sellingPrice: number;
    };
  }>;
}

export interface RecipesResponse {
  recipes: RecipeWithIngredients[];
  total: number;
}

// Query keys for cache management (DRY principle)
export const recipeKeys = {
  all: (storeId: string) => ["recipes", storeId] as const,
  lists: (storeId: string) => [...recipeKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: RecipeFilterInput) =>
    [...recipeKeys.lists(storeId), normalizeFilters(filters)] as const,
  details: (storeId: string) => [...recipeKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...recipeKeys.details(storeId), id] as const,
};

// API Functions
async function fetchRecipes(
  storeId: string,
  filters: Partial<RecipeFilterInput>
): Promise<RecipesResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
  if (filters.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters.take !== undefined) params.append("take", filters.take.toString());

  const response = await fetch(`/api/stores/${storeId}/recipes?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to fetch recipes");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function fetchRecipeById(storeId: string, recipeId: string): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to fetch recipe");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function createRecipe(
  storeId: string,
  data: CreateRecipeFormInput
): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to create recipe");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function updateRecipe(
  storeId: string,
  recipeId: string,
  data: UpdateRecipeFormInput
): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to update recipe");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function deleteRecipe(storeId: string, recipeId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete recipe");
  }
}

async function bulkDeleteRecipes(storeId: string, recipeIds: string[]): Promise<{ count: number }> {
  const response = await fetch(`/api/stores/${storeId}/recipes/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: recipeIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete recipes");
  }

  return response.json();
}

async function duplicateRecipe(
  storeId: string,
  recipeId: string,
  newName: string
): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || "Failed to duplicate recipe");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function exportRecipes(storeId: string, filters: RecipeFilterInput): Promise<void> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

  const response = await fetch(`/api/stores/${storeId}/recipes/export?${params.toString()}`);

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

    throw new Error(error.error || "Failed to export recipes");
  }

  // Download CSV file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recipes-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// React Query Hooks

/**
 * Fetch all recipes with filters
 * Real-time enabled: Polls every 30 seconds when tab is active
 */
export function useRecipes(
  storeId: string,
  filters: RecipeFilterInput,
  initialData?: RecipesResponse
) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: recipeKeys.list(storeId, normalizedFilters),
    queryFn: () => fetchRecipes(storeId, normalizedFilters || filters),
    enabled: !!storeId,
    initialData, // ✅ Accept initial data from Server Component
    // Real-time configuration: Aggressive polling for instant cross-tab updates
    staleTime: 3 * 1000, // 3 seconds - consider data stale faster
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 1000, // Poll every 5 seconds - 6x faster for real-time sync
    refetchIntervalInBackground: false, // Only poll when tab is active
    refetchOnMount: "always", // Always refetch on mount to ensure fresh data (especially after stock adjustments)
    refetchOnWindowFocus: true, // Refetch on window focus if stale
    meta: {
      refetchInterval: 5 * 1000, // Store in meta for smart polling
    },
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
  });
}

/**
 * Fetch recipes for selectors/dropdowns (optimized, no polling)
 * Use this in forms and selectors where real-time updates are not critical
 */
export function useRecipesForSelector(storeId: string, filters?: RecipeFilterInput) {
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: recipeKeys.list(storeId, normalizedFilters),
    queryFn: () => fetchRecipes(storeId, normalizedFilters || {}),
    enabled: !!storeId,
    // Optimized settings for selectors: no polling, longer staleTime
    staleTime: 5 * 60 * 1000, // 5 minutes (longer than main hook)
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false, // Disable polling for selectors
    refetchOnMount: false, // Don't refetch if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Create recipe mutation
 */
export function useCreateRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeFormInput) => createRecipe(storeId, data),
    onSuccess: (newRecipe) => {
      // Optimistic update: Add new recipe to all recipe list caches immediately
      // This ensures UI updates instantly without waiting for refetch
      queryClient.setQueriesData<RecipesResponse>(
        { queryKey: recipeKeys.lists(storeId), exact: false },
        (oldData) => {
          // Validate oldData structure before updating
          // Check if oldData exists and has the correct structure
          if (
            oldData &&
            typeof oldData === "object" &&
            "recipes" in oldData &&
            Array.isArray(oldData.recipes) &&
            typeof oldData.total === "number"
          ) {
            // Safe to update: oldData has correct structure
            return {
              recipes: [...oldData.recipes, newRecipe],
              total: oldData.total + 1,
            };
          }
          // If oldData is invalid or missing, return undefined to trigger refetch
          // This is safer than trying to update invalid data
          return undefined;
        }
      );

      // Invalidate all recipe queries to ensure consistency
      // Use immediate: true to ensure active queries refetch
      invalidateRecipeRelatedQueries(queryClient, storeId, true);
    },
  });
}

/**
 * Update recipe mutation with optimistic updates
 * Real-time: Updates UI immediately, syncs with server in background
 */
export function useUpdateRecipe(storeId: string, recipeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    RecipeWithIngredients,
    Error,
    UpdateRecipeFormInput,
    {
      previousRecipe: RecipeWithIngredients | undefined;
      previousQueries: Array<[readonly unknown[], RecipesResponse | undefined]>;
    }
  >({
    mutationFn: (data) => updateRecipe(storeId, recipeId, data),
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: recipeKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: recipeKeys.detail(storeId, recipeId) });

      // Snapshot previous values for rollback
      const previousRecipe = queryClient.getQueryData<RecipeWithIngredients>(
        recipeKeys.detail(storeId, recipeId)
      );
      const previousQueries = queryClient.getQueriesData<RecipesResponse>({
        queryKey: recipeKeys.lists(storeId),
      });

      // Optimistically update detail cache
      if (previousRecipe) {
        queryClient.setQueryData<RecipeWithIngredients>(recipeKeys.detail(storeId, recipeId), {
          ...previousRecipe,
          ...newData,
          updatedAt: new Date(),
        } as RecipeWithIngredients);
      }

      // Optimistically update all list caches
      queryClient.setQueriesData<RecipesResponse>(
        { queryKey: recipeKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.recipes) return oldData;
          return {
            ...oldData,
            recipes: oldData.recipes.map((r) =>
              r.id === recipeId
                ? ({
                    ...r,
                    ...newData,
                    updatedAt: new Date(),
                  } as RecipeWithIngredients)
                : r
            ),
          };
        }
      );

      return { previousRecipe, previousQueries };
    },
    onError: (error, newData, context) => {
      // Rollback optimistic update on error
      if (context?.previousRecipe) {
        queryClient.setQueryData(recipeKeys.detail(storeId, recipeId), context.previousRecipe);
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedRecipe) => {
      // Replace optimistic data with real server data
      queryClient.setQueryData(recipeKeys.detail(storeId, recipeId), updatedRecipe);

      // Update in all list caches with real data
      queryClient.setQueriesData<RecipesResponse>(
        { queryKey: recipeKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.recipes) return oldData;
          return {
            ...oldData,
            recipes: oldData.recipes.map((r) => (r.id === recipeId ? updatedRecipe : r)),
          };
        }
      );

      // Non-blocking cache invalidation for related queries
      invalidateRecipeRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Delete recipe mutation with optimistic updates
 * Real-time: Removes from UI immediately, syncs with server in background
 */
export function useDeleteRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    string,
    { previousQueries: Array<[readonly unknown[], RecipesResponse | undefined]> }
  >({
    mutationFn: (recipeId) => deleteRecipe(storeId, recipeId),
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: recipeKeys.lists(storeId) });

      // Snapshot previous queries
      const previousQueries = queryClient.getQueriesData<RecipesResponse>({
        queryKey: recipeKeys.lists(storeId),
      });

      // Optimistically remove from all matching caches
      queryClient.setQueriesData<RecipesResponse>(
        { queryKey: recipeKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.recipes) return oldData;
          return {
            ...oldData,
            recipes: oldData.recipes.filter((r) => r.id !== deletedId),
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
      queryClient.removeQueries({ queryKey: recipeKeys.detail(storeId, deletedId) });

      // Non-blocking cache invalidation for related queries
      invalidateRecipeRelatedQueries(queryClient, storeId, false);
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
    onSuccess: (_, recipeIds) => {
      // Remove all deleted items from cache
      recipeIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: recipeKeys.detail(storeId, id) });
      });
      // Non-blocking cache invalidation: Only invalidate recipes immediately
      // Other queries (products, materials) will sync in background
      invalidateRecipeRelatedQueries(queryClient, storeId, false);
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
      await queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      await queryClient.refetchQueries({ queryKey: ["recipes", storeId], type: "active" });
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
