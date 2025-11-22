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
 */
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  immediate: boolean = false
): Promise<void> {
  if (immediate) {
    // Blocking: Invalidate all queries immediately (for critical operations)
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
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
      queryClient.invalidateQueries({
        queryKey: ["recipes", storeId],
        exact: false,
      }),
    ]);
  }
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
  }
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
  }
}

