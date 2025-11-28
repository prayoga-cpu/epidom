import { QueryClient } from "@tanstack/react-query";
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { logger } from "@/lib/logger";

/**
 * Cache invalidation utilities
 * Optimizes cache invalidation by batching operations for better performance
 */

/**
 * Invalidate multiple related queries efficiently
 * Uses Promise.all for parallel invalidation (better performance than sequential)
 *
 * @param queryClient - TanStack Query client
 * @param queries - Array of query keys to invalidate
 */
export async function invalidateQueriesBatch(
  queryClient: QueryClient,
  queries: readonly unknown[][]
): Promise<void> {
  // Batch invalidations in parallel for better performance
  // This is faster than sequential invalidations
  await Promise.all(
    queries.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      })
    )
  );
}

/**
 * Invalidate store-related queries after material changes
 * Optimized: Materials list invalidated first (blocking),
 * other queries invalidated in parallel (can be awaited or run in background)
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param skipMaterials - If true, skip materials list invalidation (for cases where it's already invalidated)
 */
export async function invalidateMaterialQueriesImmediate(
  queryClient: QueryClient,
  storeId: string,
  skipMaterials = false
): Promise<void> {
  const invalidations = [];

  // Invalidate materials list first (most important for UX)
  if (!skipMaterials) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      })
    );
  }

  // Invalidate other related queries in parallel
  invalidations.push(
    queryClient.invalidateQueries({
      queryKey: ["suppliers", storeId],
      exact: false,
    }),
    // ✅ Fixed: Use alertKeys for consistent cache invalidation
    queryClient.invalidateQueries({
      queryKey: alertKeys.lists(storeId),
      exact: false,
    }),
    // ✅ Fixed: Use stockMovementKeys for consistent cache invalidation
    queryClient.invalidateQueries({
      queryKey: stockMovementKeys.all(storeId),
      exact: false,
    }),
    queryClient.invalidateQueries({
      queryKey: ["recipes", storeId],
      exact: false,
    })
  );

  await Promise.all(invalidations);
}

/**
 * Invalidate all store-related queries after material changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 * @param skipMaterials - If true, skip materials list invalidation
 */
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false,
  skipMaterials: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    const invalidations = [];

    if (!skipMaterials) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ["materials", storeId],
          exact: false,
          refetchType: "all", // Refetch all queries (active and inactive)
        })
      );
    }

    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["recipes", storeId],
        exact: false,
        refetchType: "all", // Recipes contain material stock, need immediate update
      }),
      queryClient.invalidateQueries({
        queryKey: ["production-batches", storeId],
        exact: false,
        refetchType: "all", // Production batches contain material stock data
      }),
      queryClient.invalidateQueries({
        queryKey: ["suppliers", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: alertKeys.lists(storeId),
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
      })
    );

    await Promise.all(invalidations);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateMaterialQueriesImmediate(queryClient, storeId, skipMaterials);

    // Also invalidate recipes immediately (they contain material stock data)
    // This ensures production tab sees updated stock when user navigates
    queryClient.invalidateQueries({
      queryKey: ["recipes", storeId],
      exact: false,
      refetchType: "active", // Refetch active queries (production tab)
    });

    // Defer non-critical invalidations to background (don't await)
    // These will sync eventually via polling or when user navigates to those pages
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["suppliers", storeId],
        exact: false,
        refetchType: "none", // Mark as stale but don't refetch immediately
      }),
      queryClient.invalidateQueries({
        queryKey: alertKeys.lists(storeId),
        exact: false,
        refetchType: "none", // Alerts will update via polling anyway
      }),
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
        refetchType: "none", // Stock movements not critical for immediate update
      }),
      queryClient.invalidateQueries({
        queryKey: ["production-batches", storeId],
        exact: false,
        refetchType: "none", // Production batches will update when user navigates
      }),
    ]).catch((error) => {
      // Silently handle errors in background invalidation
      logger.warn("Background cache invalidation failed", { error });
    });
  }
}

/**
 * Invalidate all store-related queries after product changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 * @param skipProducts - If true, skip products list invalidation
 */
export async function invalidateProductRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false,
  skipProducts: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    const invalidations = [];

    if (!skipProducts) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ["products", storeId],
          exact: false,
        })
      );
    }

    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["product-usage", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: alertKeys.lists(storeId),
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ["recipes", storeId],
        exact: false,
      })
    );

    await Promise.all(invalidations);
  }
}

/**
 * Invalidate critical queries immediately (recipes only)
 * Used for immediate UI updates without blocking
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param skipRecipes - If true, skip recipes list invalidation
 */
export function invalidateRecipeQueriesImmediate(
  queryClient: QueryClient,
  storeId: string,
  skipRecipes: boolean = false
): void {
  // Invalidate all recipe queries (both active and inactive)
  // This ensures recipe lists update everywhere (recipes tab, product form, etc.)
  if (!skipRecipes) {
    queryClient.invalidateQueries({
      queryKey: ["recipes", storeId],
      exact: false,
      refetchType: "all", // Refetch all queries (active and inactive) to ensure consistency
    });
  }
}

/**
 * Invalidate all store-related queries after recipe changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 * @param skipRecipes - If true, skip recipes list invalidation
 */
export async function invalidateRecipeRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false,
  skipRecipes: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    const invalidations = [];

    if (!skipRecipes) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ["recipes", storeId],
          exact: false,
        })
      );
    }

    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["products", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      })
    );

    await Promise.all(invalidations);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateRecipeQueriesImmediate(queryClient, storeId, skipRecipes);

    // Defer non-critical invalidations to background (don't await)
    // These will sync eventually via polling or when user navigates to those pages
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["products", storeId],
        exact: false,
        refetchType: "none", // Products will update when user navigates to products page
      }),
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
        refetchType: "none", // Materials will update when user navigates to materials page
      }),
    ]).catch((error) => {
      // Silently handle errors in background invalidation
      logger.warn("Background cache invalidation failed", { error });
    });
  }
}

/**
 * Invalidate critical queries immediately (suppliers only)
 * Used for immediate UI updates without blocking
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param skipSuppliers - If true, skip suppliers list invalidation
 */
export function invalidateSupplierQueriesImmediate(
  queryClient: QueryClient,
  storeId: string,
  skipSuppliers: boolean = false
): void {
  // Only invalidate suppliers immediately (non-blocking)
  // This allows UI to update fast while other queries sync in background
  if (!skipSuppliers) {
    queryClient.invalidateQueries({
      queryKey: ["suppliers", storeId],
      exact: false,
      refetchType: "active", // Only refetch active queries (visible tabs)
    });
  }
}

/**
 * Invalidate all store-related queries after supplier changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 * @param skipSuppliers - If true, skip suppliers list invalidation
 */
export async function invalidateSupplierRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false,
  skipSuppliers: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    const invalidations = [];

    if (!skipSuppliers) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ["suppliers", storeId],
          exact: false,
        })
      );
    }

    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      })
    );

    await Promise.all(invalidations);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateSupplierQueriesImmediate(queryClient, storeId, skipSuppliers);
  }
}
