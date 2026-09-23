"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CustomerDetailDto, CustomerListDto, LoyaltySettingsDto } from "@/types/api/cashier";

/**
 * Only the sorts the API can do in SQL. lifetimeSpend / orderCount / lastOrderAt
 * are aggregated from Order per returned page, so ordering by them would mean
 * aggregating the whole table before the first page could be cut.
 */
export type CustomerSortOption = "name" | "newest" | "oldest" | "points";

export const CUSTOMER_PAGE_SIZE = 25;

/**
 * Everything hangs off ["customers", storeId] so ONE prefix invalidation after a
 * create / edit / points adjustment refreshes the list, the summary tiles and
 * any open detail together. The POS picker caches under a different root
 * (["pos", "customers", storeId] in features/pos/hooks/use-customers.ts), so
 * use-customer-mutations.ts invalidates that one explicitly as well.
 */
export const customerKeys = {
  all: (storeId: string) => ["customers", storeId] as const,
  list: (storeId: string, filters: { q: string; sort: CustomerSortOption }) =>
    ["customers", storeId, "list", filters] as const,
  summary: (storeId: string) => ["customers", storeId, "summary"] as const,
  detail: (storeId: string, customerId: string) =>
    ["customers", storeId, "detail", customerId] as const,
};

/**
 * Cursor-paginated list. The search text and sort live in the query key, so
 * changing either starts from a fresh first page (that IS the "search resets the
 * cursor" behaviour — no cursor is ever carried across keys).
 *
 * keepPreviousData: while the next search is in flight the last rows stay on
 * screen instead of the table collapsing to a skeleton on every pause in typing.
 */
export function useCustomerList(storeId: string, filters: { q: string; sort: CustomerSortOption }) {
  return useInfiniteQuery({
    queryKey: customerKeys.list(storeId, filters),
    queryFn: ({ pageParam }) => {
      const params: Record<string, string> = {
        limit: String(CUSTOMER_PAGE_SIZE),
        sort: filters.sort,
      };
      if (filters.q) params.q = filters.q;
      if (pageParam) params.cursor = pageParam;
      return apiClient.get<CustomerListDto>(`/stores/${storeId}/customers`, params);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    enabled: !!storeId,
  });
}

/**
 * The summary tiles are store-wide, so they get their own unfiltered request
 * instead of riding on the list's first page: that page carries the SEARCH's
 * `totalCount`, and the tiles must not move while the owner types. limit=1 keeps
 * the customer aggregation to a single row — only `summary` and `totalCount` are
 * read from it.
 */
export function useCustomerSummary(storeId: string) {
  return useQuery({
    queryKey: customerKeys.summary(storeId),
    queryFn: () =>
      apiClient.get<CustomerListDto>(`/stores/${storeId}/customers`, {
        limit: "1",
        includeSummary: "1",
      }),
    enabled: !!storeId,
    staleTime: 30 * 1000,
  });
}

/** One customer with their last 20 orders and last 30 loyalty entries. */
export function useCustomerDetail(storeId: string, customerId: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(storeId, customerId ?? ""),
    queryFn: () =>
      apiClient.get<CustomerDetailDto>(`/stores/${storeId}/customers/${customerId as string}`),
    enabled: !!storeId && !!customerId,
  });
}

/**
 * Whether the store runs a loyalty program. GET /loyalty-settings is
 * OPERATIONS-tier and answers 403 below it, so ANY failure means "off": the
 * points columns, tiles and adjust form must simply not exist for that store.
 *
 * `retry: false` — a 403 is an answer, not a blip, and retrying it three times
 * would delay the whole table (which waits for `isSettled` so the loyalty
 * columns never pop in after the first paint).
 */
export function useLoyaltyEnabled(storeId: string) {
  const query = useQuery({
    queryKey: ["customers-loyalty-settings", storeId],
    queryFn: () => apiClient.get<LoyaltySettingsDto>(`/stores/${storeId}/loyalty-settings`),
    enabled: !!storeId,
    retry: false,
    staleTime: 60 * 1000,
  });
  return { enabled: query.data?.enabled === true, isSettled: !query.isPending };
}
