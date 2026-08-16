import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateRecipeFormInput,
  UpdateRecipeFormInput,
  RecipeFilterInput,
  type CategoryDeleteMode,
} from "@/lib/validation/inventory.schemas";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import { invalidateRecipeRelatedQueries } from "@/lib/utils/cache-helpers";
import { trackEvent } from "@/lib/analytics";
import { ApiClientError } from "@/lib/api/client";
import { unwrapApiData, unwrapApiError } from "@/lib/api/unwrap";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

// Types

/**
 * Mirrors the Prisma `StockMode` enum. Declared locally rather than imported
 * from `@prisma/client` so client bundles don't pull the Prisma runtime in.
 *
 * - BATCH_PRODUCED — made ahead, counted on the shelf. The only mode the
 *   Production screen can act on.
 * - MADE_TO_ORDER  — cooked when sold; ingredients come out at sale time.
 * - UNTRACKED      — no stock maths at all.
 */
export type StockMode = "BATCH_PRODUCED" | "MADE_TO_ORDER" | "UNTRACKED";

/**
 * Mirrors the Prisma `RecipeType` enum. Declared locally so client bundles
 * don't pull the Prisma runtime in.
 *
 * This says how the RECIPE IS PRODUCED. It is NOT `Product.stockMode`, which
 * says what a SALE consumes — do not read one to decide the other.
 *
 * - KITCHEN — cooked fresh when ordered. Ingredients leave AT THE SALE, scaled
 *   per portion. Never appears on the Production page.
 * - BATCH   — made ahead in whole, indivisible batches on the Production page.
 *   A dough yielding 5 baguettes cannot be run for 3: asking for 3 bakes one
 *   whole batch, a full batch of ingredients leaves and 5 land on the shelf.
 */
export type RecipeType = "KITCHEN" | "BATCH";

export const RECIPE_TYPES: readonly RecipeType[] = ["KITCHEN", "BATCH"];

/**
 * Option metadata for the two type radio cards, shared by the add and edit
 * dialogs so the copy can never drift between them.
 */
export const RECIPE_TYPE_OPTIONS: ReadonlyArray<{
  value: RecipeType;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "KITCHEN",
    labelKey: "data.recipes.type.kitchen.label",
    descriptionKey: "data.recipes.type.kitchen.description",
  },
  {
    value: "BATCH",
    labelKey: "data.recipes.type.batch.label",
    descriptionKey: "data.recipes.type.batch.description",
  },
];

/**
 * Read a recipe's production type defensively. Recipes written before
 * `Recipe.type` existed — and any payload whose serializer hasn't been taught
 * the field yet — come back without it; those are all cook-to-order.
 */
export function getRecipeType(recipe: { type?: RecipeType | null }): RecipeType {
  return recipe.type ?? "KITCHEN";
}

/** Translation key for the small list/details badge. */
export function getRecipeTypeBadgeKey(recipe: { type?: RecipeType | null }): string {
  return getRecipeType(recipe) === "BATCH"
    ? "data.recipes.type.badgeBatch"
    : "data.recipes.type.badgeKitchen";
}

export interface RecipeWithIngredients {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  department: "KITCHEN" | "BAR" | null;
  /**
   * Nullable on purpose: the Server-Component payload for the first paint is
   * built by `serializeRecipe`, a whitelist that does not carry `type` yet, so
   * it can legitimately be missing. Read it through `getRecipeType()`.
   */
  type: RecipeType | null;
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
    product: {
      id: string;
      name: string;
      sku: string;
      category: string | null;
      unit: string;
      /** Branch on this, never on the deprecated `trackStock`. */
      stockMode: StockMode;
      /** Replaces the dead `RecipeProduct.isDefault` flag. */
      primaryRecipeId: string | null;
      currentStock: number;
      minStock: number;
      maxStock: number;
      costPrice: number;
      sellingPrice: number;
    };
  }>;
}

/**
 * Only a BATCH_PRODUCED product can be "produced": you make it ahead and count
 * it onto the shelf. A MADE_TO_ORDER dish has no counted balance — its
 * ingredients leave inventory at the moment it is sold — and an UNTRACKED one
 * has no stock maths at all, so neither belongs on the Production screen.
 */
export function isBatchProduced(product: { stockMode: StockMode }): boolean {
  return product.stockMode === "BATCH_PRODUCED";
}

/** True when at least one linked product is actually batch-produced. */
export function hasBatchProducedProduct(recipe: RecipeWithIngredients): boolean {
  return (recipe.recipeProducts ?? []).some((rp) => isBatchProduced(rp.product));
}

/**
 * Recipe list filters. `RecipeFilterInput` is the shared Zod-derived shape;
 * `producibleOnly` is an extra narrowing the Production screen needs (see the
 * note on `fetchRecipes`).
 */
export type RecipeListFilters = RecipeFilterInput & {
  /**
   * Restrict to recipes linked to at least one BATCH_PRODUCED product.
   * Applied SERVER-SIDE on purpose: the Produce tab pages with `take`, so a
   * client-only filter would silently return a differently-truncated list.
   */
  producibleOnly?: boolean;
};

export interface RecipesResponse {
  recipes: RecipeWithIngredients[];
  total: number;
}

/**
 * Wire payloads. The shared form schemas in `inventory.schemas.ts` don't carry
 * `type` yet, so the dialogs extend their local resolver schema with it and
 * these aliases carry it the rest of the way. Without them the field would be
 * dropped at the `JSON.stringify` boundary with no type error to catch it.
 */
export type CreateRecipePayload = CreateRecipeFormInput & { type: RecipeType };
export type UpdateRecipePayload = UpdateRecipeFormInput & { type?: RecipeType };

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
  filters: Partial<RecipeListFilters>
): Promise<RecipesResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.department) params.append("department", filters.department);
  // NOTE: GET /api/stores/[id]/recipes must accept this and translate it to
  // `recipeProducts: { some: { product: { stockMode: BATCH_PRODUCED } } }`.
  // Until it does, the server ignores the param and the Produce tab falls back
  // to its defensive client-side guard (see recipe-production.tsx).
  if (filters.producibleOnly) params.append("producibleOnly", "true");
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
  if (filters.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters.take !== undefined) params.append("take", filters.take.toString());

  const response = await fetch(`/api/stores/${storeId}/recipes?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new ApiClientError(error, response.status);
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function fetchRecipeById(storeId: string, recipeId: string): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new ApiClientError(error, response.status);
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function createRecipe(
  storeId: string,
  data: CreateRecipePayload
): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiClientError(error, response.status);
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function updateRecipe(
  storeId: string,
  recipeId: string,
  data: UpdateRecipePayload
): Promise<RecipeWithIngredients> {
  const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiClientError(error, response.status);
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
    throw new ApiClientError(error, response.status);
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
    throw new ApiClientError(error, response.status);
  }

  // Route answers createSuccessResponse({ message, count }) — the count the
  // success toast prints lives one level down.
  return unwrapApiData<{ count: number }>(await response.json());
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
    throw new ApiClientError(error, response.status);
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function exportRecipes(storeId: string, filters: RecipeFilterInput): Promise<void> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.department) params.append("department", filters.department);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

  const response = await fetch(`/api/stores/${storeId}/recipes/export?${params.toString()}`);

  if (!response.ok) {
    // The export route reports failures through createErrorResponse, so code
    // and message sit under `error` — read off the top level this 403 branch
    // never matched and a locked plan got a generic export failure.
    const raw = await response.json().catch(() => ({}));
    const error = unwrapApiError(raw);

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

    // `raw`: ApiClientError reads `response.error.message`.
    throw new ApiClientError(raw, response.status);
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
  filters: RecipeListFilters,
  initialData?: RecipesResponse
) {
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);
  const queryClient = useQueryClient();

  useRealtimeChannel(storeId, {
    [REALTIME_EVENTS.RECIPE_CHANGED]: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
    [REALTIME_EVENTS.STOCK_CHANGED]: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
  });

  return useQuery({
    queryKey: recipeKeys.list(storeId, normalizedFilters),
    queryFn: () => fetchRecipes(storeId, normalizedFilters || filters),
    enabled: !!storeId,
    initialData, // ✅ Accept initial data from Server Component
    // Real-time configuration: Pusher (see useRealtimeChannel below) is the
    // primary update path; this poll is only a safety net for when push
    // misses an event, so it doesn't need safety-net-grade CPU cost.
    staleTime: 20 * 1000,
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Safety-net poll — Pusher covers the instant case
    refetchIntervalInBackground: false, // Only poll when tab is active
    refetchOnMount: "always", // Always refetch on mount to ensure fresh data (especially after stock adjustments)
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
    mutationFn: (data: CreateRecipePayload) => createRecipe(storeId, data),
    onSuccess: (newRecipe) => {
      trackEvent("create_recipe", { event_category: "dashboard_activity" });

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
    UpdateRecipePayload,
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
      invalidateRecipeRelatedQueries(queryClient, storeId, false, true);
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
      invalidateRecipeRelatedQueries(queryClient, storeId, false, true);
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
 * Delete a category. Recipe categories are a fixed preset list, not a
 * separate entity, so this affects every recipe that has it: "uncategorize"
 * (default) clears the tag and keeps the recipes, "delete" removes the
 * recipes themselves.
 */
export function useDeleteRecipeCategory(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      category,
      mode = "uncategorize",
    }: {
      category: string;
      mode?: CategoryDeleteMode;
    }) => {
      const response = await fetch(
        `/api/stores/${storeId}/recipes/categories/${encodeURIComponent(category)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new ApiClientError(errorData, response.status);
      }

      const responseData = await response.json();
      return responseData.success === true ? responseData.data : responseData;
    },
    onSuccess: (_, { category, mode = "uncategorize" }) => {
      // Optimistically update all matching cached recipes
      queryClient.setQueriesData<RecipesResponse>(
        { queryKey: recipeKeys.lists(storeId), exact: false },
        (oldData) => {
          if (!oldData || !oldData.recipes) return oldData;
          if (mode === "delete") {
            const remaining = oldData.recipes.filter((r) => r.category !== category);
            return {
              ...oldData,
              recipes: remaining,
              total: Math.max(0, oldData.total - (oldData.recipes.length - remaining.length)),
            };
          }
          return {
            ...oldData,
            recipes: oldData.recipes.map((r) =>
              r.category === category ? { ...r, category: null } : r
            ),
          };
        }
      );

      invalidateRecipeRelatedQueries(queryClient, storeId, true);
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

/**
 * Fetch 30-day POS order counts per recipe.
 * Returns a Map<recipeId, orderCount> for O(1) badge lookups.
 */
export function useRecipeDemand(storeId: string): Map<string, number> {
  const { data } = useQuery<{ recipeId: string; orderCount30d: number }[]>({
    queryKey: ["recipe-demand", storeId],
    queryFn: () =>
      fetch(`/api/stores/${storeId}/recipes/demand`)
        .then((r) => r.json())
        .then((d) => d?.data ?? []),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
  return new Map((data ?? []).map((r) => [r.recipeId, r.orderCount30d]));
}
