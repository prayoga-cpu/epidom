import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateRecipeFormInput,
  UpdateRecipeFormInput,
  RecipeFilterInput,
} from "@/lib/validation/inventory.schemas";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";

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

// API Functions
async function fetchRecipes(storeId: string, filters: RecipeFilterInput): Promise<RecipesResponse> {
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
    throw new Error(error.error || "Failed to fetch recipes");
  }

  return response.json();
}

async function fetchRecipeById(storeId: string, recipeId: string): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch recipe");
  }

  return response.json();
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
    throw new Error(error.error || "Failed to create recipe");
  }

  return response.json();
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
    throw new Error(error.error || "Failed to update recipe");
  }

  return response.json();
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
    throw new Error(error.error || "Failed to duplicate recipe");
  }

  return response.json();
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
export function useRecipes(storeId: string, filters: RecipeFilterInput) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: ["recipes", storeId, normalizedFilters],
    queryFn: () => fetchRecipes(storeId, normalizedFilters || filters),
    enabled: !!storeId,
    // Optimized for real-time updates after mutations
    staleTime: 5 * 1000, // 5 seconds - shorter to ensure fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Only poll when tab is active
    refetchOnMount: true, // Always check for updates on mount
    refetchOnWindowFocus: true, // Refetch on window focus if stale
    meta: {
      refetchInterval: 30 * 1000, // Store in meta for smart polling
    },
  });
}

/**
 * Fetch single recipe by ID
 */
export function useRecipe(storeId: string, recipeId: string | null) {
  return useQuery({
    queryKey: ["recipes", storeId, recipeId],
    queryFn: () => fetchRecipeById(storeId, recipeId!),
    enabled: !!storeId && !!recipeId,
  });
}

/**
 * Create recipe mutation
 */
export function useCreateRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeFormInput) => createRecipe(storeId, data),
    onSuccess: async () => {
      // Invalidate and immediately refetch all recipe queries for this store
      await queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      // Force refetch to ensure UI updates immediately
      await queryClient.refetchQueries({ queryKey: ["recipes", storeId], type: "active" });
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
      // Invalidate and immediately refetch all recipe queries for this store
      await queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["recipes", storeId, recipeId] });
      await queryClient.refetchQueries({ queryKey: ["recipes", storeId], type: "active" });
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
      await queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      await queryClient.refetchQueries({ queryKey: ["recipes", storeId], type: "active" });
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
      await queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      await queryClient.refetchQueries({ queryKey: ["recipes", storeId], type: "active" });
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
