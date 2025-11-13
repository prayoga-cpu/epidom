import { QueryClient } from "@tanstack/react-query";
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { recipeKeys } from "@/features/dashboard/data/recipes/hooks/use-recipes";

/**
 * Cache Invalidation Utilities
 *
 * Centralized cache invalidation patterns to reduce code duplication
 * and ensure consistent cache management across the application.
 *
 * All functions use Promise.all for parallel invalidation (better performance)
 */

/**
 * Generic function to invalidate store queries for a specific resource
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param resource - Resource name (e.g., "materials", "products", "recipes")
 */
export async function invalidateStoreQueries(
  queryClient: QueryClient,
  storeId: string,
  resource: "materials" | "products" | "recipes" | "suppliers" | "production-batches"
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: [resource, storeId],
    exact: false, // Invalidate all queries starting with this key
  });
}

/**
 * Invalidate material-related queries
 * Optimized to batch all invalidations in parallel for better performance
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 */
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string
): Promise<void> {
  // Batch all invalidations in parallel for better performance
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
      queryKey: ["stock-movements", storeId],
      exact: false,
    }),
    queryClient.invalidateQueries({
      queryKey: recipeKeys.lists(storeId),
      exact: false,
    }),
  ]);
}

/**
 * Invalidate product-related queries
 * Used when products are created, updated, or deleted
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param productId - Optional product ID for specific product invalidation
 */
export async function invalidateProductRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  productId?: string
): Promise<void> {
  const invalidations = [
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
      queryKey: ["stock-movements", storeId],
      exact: false,
    }),
  ];

  // If productId is provided, also invalidate the specific product
  if (productId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["products", storeId, productId],
        exact: false,
      })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate production-related queries
 * Used when production batches are created, updated, or completed
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param batchId - Optional batch ID for specific batch invalidation
 */
export async function invalidateProductionRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  batchId?: string
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: ["production-batches", storeId],
      exact: false,
    }),
    queryClient.invalidateQueries({
      queryKey: ["materials", storeId],
      exact: false,
    }),
    queryClient.invalidateQueries({
      queryKey: ["products", storeId],
      exact: false,
    }),
    queryClient.invalidateQueries({
      queryKey: alertKeys.lists(storeId),
      exact: false,
    }),
    queryClient.invalidateQueries({
      queryKey: ["stock-movements", storeId],
      exact: false,
    }),
  ];

  // If batchId is provided, also invalidate the specific batch
  if (batchId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["production-batches", storeId, batchId],
        exact: false,
      })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate recipe-related queries
 * Used when recipes are created, updated, or deleted
 *
 * @param queryClient - TanStack Query client
 * @param storeId - Store ID
 * @param recipeId - Optional recipe ID for specific recipe invalidation
 */
export async function invalidateRecipeRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  recipeId?: string
): Promise<void> {
  // Invalidate ALL recipe queries for this store (more aggressive approach)
  // This ensures all queries with different filters are invalidated
  await queryClient.invalidateQueries({
    queryKey: recipeKeys.all(storeId),
    exact: false,
  });

  // Force refetch ALL recipe list queries to ensure UI updates immediately
  // This is important because invalidateQueries only marks queries as stale,
  // but won't refetch if staleTime hasn't expired yet
  await queryClient.refetchQueries({
    queryKey: recipeKeys.all(storeId),
    exact: false,
  });

  // If recipeId is provided, also invalidate and refetch the specific recipe
  if (recipeId) {
    await queryClient.invalidateQueries({
      queryKey: recipeKeys.detail(storeId, recipeId),
      exact: false,
    });
    await queryClient.refetchQueries({
      queryKey: recipeKeys.detail(storeId, recipeId),
      exact: false,
    });
  }
}

/**
 * Batch invalidate multiple queries efficiently
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
  await Promise.all(
    queries.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
        exact: false,
      })
    )
  );
}
