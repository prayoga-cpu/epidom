import { QueryClient } from "@tanstack/react-query";
import { alertKeys } from "@/features/dashboard/shared/hooks/use-alerts";
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

    // The primary materials list gets refetchType "all", not the default
    // "active". The page that mutates stock frequently has no materials query
    // mounted at all — /production reads material stock off the *recipes*
    // query — so "active" found nothing to refetch and the merchant landed on
    // /management still looking at pre-mutation numbers. Only this one key is
    // promoted; the deferred set below stays "none" so a single stock write
    // can't stampede every list in the app.
    if (!skipMaterials) {
      queryClient.invalidateQueries({
        queryKey: ["materials", storeId],
        exact: false,
        refetchType: "all",
      });
    }

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
      }),
      queryClient.invalidateQueries({
        queryKey: ["storefront-items-linked", storeId],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ["pos", "menu", storeId],
        exact: false,
      })
    );

    await Promise.all(invalidations);
  } else {
    // Non-blocking: Invalidate critical queries immediately, defer others.
    // "all" rather than "active" for the same reason as the materials list
    // above: completing a production batch adds finished-goods stock from a
    // page that has no products query mounted.
    if (!skipProducts) {
      queryClient.invalidateQueries({
        queryKey: ["products", storeId],
        exact: false,
        refetchType: "all",
      });
    }

    // Defer non-critical invalidations to background
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["product-usage", storeId],
        exact: false,
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: alertKeys.lists(storeId),
        exact: false,
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: ["recipes", storeId],
        exact: false,
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: ["storefront-items-linked", storeId],
        exact: false,
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: ["pos", "menu", storeId],
        exact: false,
        refetchType: "none",
      }),
    ]).catch((error) => {
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

/**
 * Cache-key prefixes that read order status/revenue and must be refreshed
 * whenever an order's status or refund amount changes (cancel, refund,
 * mark-paid). Derived by cross-referencing every API route that filters
 * `NON_REVENUE_STATUSES` (`src/lib/constants/order-status.ts`) against its
 * actual client-side consumer's query key — grep
 * `grep -rln NON_REVENUE_STATUSES src/app/api` and re-check this list if a
 * report ever looks stuck again, since each feature area invented its own
 * naming independently instead of sharing one prefix:
 *
 * - `finance-*` — `finance-client.tsx`'s dozen report queries, plus
 *   `finance-settings` (unrelated to revenue, harmless to over-invalidate).
 * - `analytics-*` — the dashboard's `analytics-section.tsx`
 *   (`/orders/analytics`, `/customers/analytics`, `/finance/top-items`,
 *   `/finance/by-department`), 5-minute staleTime — longer than
 *   `finance-*`'s 30s, so this one was *more* likely to look stuck.
 * - `owner-summary` — the multi-store Enterprise rollup
 *   (`owner-dashboard-client.tsx`, `/api/owner/summary`); not per-store
 *   (no storeId in its key), which is fine for a predicate match.
 * - `storefront-analytics*` — the Storefront editor's own analytics tab
 *   (`storefront-analytics.tsx`, `/api/stores/[id]/storefront/analytics`).
 */
const REVENUE_QUERY_KEY_PREFIXES = [
  "finance-",
  "analytics-",
  "owner-summary",
  "storefront-analytics",
];

/**
 * Invalidate every Finance report AND dashboard analytics query for a store.
 *
 * Each fans its data out across many independent `useQuery` calls, each
 * keyed by its own literal string (`["finance-summary", ...]`,
 * `["analytics-orders", ...]`, etc) rather than a shared array prefix — so
 * there's no single `invalidateQueries({ queryKey })` call that catches them
 * all. A predicate on the first key segment's string prefix does, and keeps
 * working if a new `finance-*`/`analytics-*` query is added later without
 * anyone having to remember to list it here too.
 *
 * Call this from any mutation that changes which orders count as revenue
 * (cancel, refund, mark-paid) — otherwise the Finance page and dashboard
 * analytics keep serving whatever they last cached for up to their
 * staleTime, making the change look like it "didn't take" for however long
 * is left of that window.
 */
export function invalidateFinanceQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const firstKey = query.queryKey[0];
      return (
        typeof firstKey === "string" &&
        REVENUE_QUERY_KEY_PREFIXES.some((prefix) => firstKey.startsWith(prefix))
      );
    },
    // Default refetchType ("active") skips any report the operator isn't
    // currently looking at — e.g. they cancel from Order History while
    // Finance sits cached-but-unmounted in another tab. "all" forces those
    // to refetch too, so switching back doesn't show pre-cancel numbers.
    refetchType: "all",
  });
}
