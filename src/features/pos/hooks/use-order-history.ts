import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { OrderHistoryFilters, OrderHistoryPage } from "../types/pos.types";
import { apiClient } from "@/lib/api/client";

export interface PaymentMethodTotal {
  paymentMethod: string;
  orderCount: number;
  revenue: number;
  percentOfTotal: number;
}

interface PaymentTotalsResponse {
  methods: PaymentMethodTotal[];
  totalRevenue: number;
  totalOrders: number;
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

/**
 * The date filters normally hold a date-only `YYYY-MM-DD` (what
 * `<input type="date">` produces) and get widened to a whole-day window. A
 * shift filter instead stores a full ISO datetime — a till session's
 * open→close window has minute precision — and must pass through untouched,
 * or `2026-08-09T22:00:00.000ZT00:00:00Z` reaches the server as garbage.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toRangeStart(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value;
}

function toRangeEnd(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T23:59:59Z` : value;
}

export function buildOrderHistoryParams(
  filters: OrderHistoryFilters,
  take: number,
  cursor?: string | null
): URLSearchParams {
  const params = new URLSearchParams({ take: String(take) });
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.source && filters.source !== "ALL") params.set("source", filters.source);
  if (filters.from) params.set("from", toRangeStart(filters.from));
  if (filters.to) params.set("to", toRangeEnd(filters.to));
  if (filters.unpaidOnly) params.set("unpaid", "1");
  if (filters.productId && filters.productId !== "ALL") params.set("productId", filters.productId);
  if (filters.department && filters.department !== "ALL")
    params.set("department", filters.department);
  if (filters.staffId && filters.staffId !== "ALL") params.set("staffId", filters.staffId);
  if (filters.paymentMethod && filters.paymentMethod !== "ALL")
    params.set("paymentMethod", filters.paymentMethod);
  if (cursor) params.set("cursor", cursor);
  return params;
}

export function useOrderHistory(storeId: string, filters: OrderHistoryFilters) {
  return useInfiniteQuery({
    queryKey: ["pos", "order-history", storeId, filters],
    queryFn: async ({ pageParam }) => {
      const params = buildOrderHistoryParams(filters, 25, pageParam);
      return apiClient.get<OrderHistoryPage>(`/stores/${storeId}/orders?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!storeId,
  });
}

// Revenue/order-count per payment method for exactly what useOrderHistory's
// filters currently match (same buildOrderHistoryParams, same `where` on the
// server) — a self-serve audit total for the History tab's own filter set,
// not tied to Finance Reports' page-level access (see
// staff-permissions.config.ts: Finance Reports isn't in any non-owner role's
// default pages, but the History tab is).
export function useOrderPaymentTotals(storeId: string, filters: OrderHistoryFilters) {
  return useQuery({
    queryKey: ["pos", "order-history-payment-totals", storeId, filters],
    queryFn: async () => {
      const params = buildOrderHistoryParams(filters, 0);
      return apiClient.get<PaymentTotalsResponse>(
        `/stores/${storeId}/orders/payment-totals?${params.toString()}`
      );
    },
    enabled: !!storeId,
  });
}
