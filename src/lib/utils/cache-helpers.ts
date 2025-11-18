import { QueryClient } from "@tanstack/react-query";
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";

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
 * Optimized to batch all invalidations in parallel for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 */
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string
): Promise<void> {
  // Use prefix matching to invalidate all related queries efficiently
  // This is more performant than individual invalidations
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["materials", storeId],
      exact: false, // Invalidate all queries starting with this key
    }),
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
    }),
  ]);
}

