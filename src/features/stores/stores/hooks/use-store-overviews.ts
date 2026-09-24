"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiSuccessResponse } from "@/types/api/responses";
import type { StoreOverview } from "@/types/api/store-overview";
import { UnauthorizedError, isUnauthorizedError } from "@/lib/api/unauthorized";

/**
 * Sits under storeKeys.lists() (["stores", "list"]), so every create, update
 * and delete invalidation of the store list refetches it too, and so does an
 * invalidation of ["stores"]. Written out rather than built from storeKeys so
 * this module doesn't depend on use-stores (tests mock that module).
 */
export const storeOverviewsKey = ["stores", "list", "overview"] as const;

/**
 * Branding and summary for the Your Stores cards (GET /api/stores/overview).
 * Only the Your Stores page calls it; the store switchers keep using the
 * plain GET /api/stores. The cards never wait for it: they render from
 * useStores and fill in once this arrives, and a failure just leaves it out.
 */
export function useStoreOverviews(enabled = true) {
  return useQuery<StoreOverview[]>({
    queryKey: storeOverviewsKey,
    queryFn: async () => {
      const response = await fetch("/api/stores/overview");
      if (response.status === 401) throw new UnauthorizedError();
      if (!response.ok) throw new Error("Failed to load store overview");
      const body: ApiSuccessResponse<StoreOverview[]> = await response.json();
      return body.data;
    },
    // Totals, slogan, currency and market are all edited inside a store, and
    // none of those saves invalidate this key: refetch every time the owner
    // comes back to /stores instead.
    staleTime: 0,
    retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 1,
    enabled,
  });
}
