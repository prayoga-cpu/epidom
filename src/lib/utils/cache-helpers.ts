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
 * Invalidate critical queries immediately (materials only)
 * Used for immediate UI updates without blocking
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 */
export function invalidateMaterialQueriesImmediate(
  queryClient: QueryClient,
  storeId: string
): void {
  // Only invalidate materials immediately (non-blocking)
  // This allows UI to update fast while other queries sync in background
  queryClient.invalidateQueries({
    queryKey: ["materials", storeId],
    exact: false,
    refetchType: "active", // Only refetch active queries (visible tabs)
  });
}

/**
 * Invalidate all store-related queries after material changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 */
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    // Use refetchType: "all" to ensure all queries refetch, not just active ones
    // This ensures production tab sees updates even if it's not currently mounted
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
        refetchType: "all", // Refetch all queries (active and inactive)
      }),
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
      }),
    ]);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateMaterialQueriesImmediate(queryClient, storeId);

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
 * Invalidate critical queries immediately (products only)
 * Used for immediate UI updates without blocking
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 */
export function invalidateProductQueriesImmediate(
  queryClient: QueryClient,
  storeId: string
): void {
  // Only invalidate products immediately (non-blocking)
  // This allows UI to update fast while other queries sync in background
  queryClient.invalidateQueries({
    queryKey: ["products", storeId],
    exact: false,
    refetchType: "active", // Only refetch active queries (visible tabs)
  });
}

/**
 * Invalidate all store-related queries after product changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 */
export async function invalidateProductRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["products", storeId],
        exact: false,
      }),
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
      }),
    ]);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateProductQueriesImmediate(queryClient, storeId);

    // Defer non-critical invalidations to background (don't await)
    // These will sync eventually via polling or when user navigates to those pages
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["product-usage", storeId],
        exact: false,
        refetchType: "none", // Product usage not critical for immediate update
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
        queryKey: ["recipes", storeId],
        exact: false,
        refetchType: "none", // Recipes will update when user navigates to recipes page
      }),
    ]).catch((error) => {
      // Silently handle errors in background invalidation
      logger.warn("Background cache invalidation failed", { error });
    });
  }
}

/**
 * Invalidate critical queries immediately (recipes only)
 * Used for immediate UI updates without blocking
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 */
export function invalidateRecipeQueriesImmediate(
  queryClient: QueryClient,
  storeId: string
): void {
  // Invalidate all recipe queries (both active and inactive)
  // This ensures recipe lists update everywhere (recipes tab, product form, etc.)
  queryClient.invalidateQueries({
    queryKey: ["recipes", storeId],
    exact: false,
    refetchType: "all", // Refetch all queries (active and inactive) to ensure consistency
  });
}

/**
 * Invalidate all store-related queries after recipe changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 */
export async function invalidateRecipeRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["recipes", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ["products", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      }),
    ]);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateRecipeQueriesImmediate(queryClient, storeId);

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
 */
export function invalidateSupplierQueriesImmediate(
  queryClient: QueryClient,
  storeId: string
): void {
  // Only invalidate suppliers immediately (non-blocking)
  // This allows UI to update fast while other queries sync in background
  queryClient.invalidateQueries({
    queryKey: ["suppliers", storeId],
    exact: false,
    refetchType: "active", // Only refetch active queries (visible tabs)
  });
}

/**
 * Invalidate all store-related queries after supplier changes
 * Non-critical invalidations are deferred to background for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param immediate - If true, invalidate immediately (blocking). If false, defer to background (non-blocking)
 */
export async function invalidateSupplierRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["suppliers", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
      }),
    ]);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others
    // This allows UI to respond faster while background sync happens
    invalidateSupplierQueriesImmediate(queryClient, storeId);

    // Defer non-critical invalidations to background (don't await)
    // These will sync eventually via polling or when user navigates to those pages
    Promise.all([
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

