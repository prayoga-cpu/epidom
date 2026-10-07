import { apiClient } from "@/lib/api/client";
import type { AdjustmentsData, LabourData, SalesPatternsData, TaxData } from "./finance-types";

/**
 * Query definitions for the Finance tabs that load on their own — each tab
 * runs its query only once opened, and the Excel export reaches the same
 * cache entry with `queryClient.fetchQuery`, so a sheet never re-fetches a
 * tab that's already on screen.
 */
export interface FinanceQueryScope {
  storeId: string;
  /** from/to as sent to the API (date-only widened, or a till session's window). */
  rangeFrom: string;
  rangeTo: string;
  staffId: string | null;
  channel: string | null;
  paymentMethod: string | null;
}

const base = (scope: FinanceQueryScope) => `/stores/${scope.storeId}/finance`;

const dateQuery = (scope: FinanceQueryScope) =>
  `from=${encodeURIComponent(scope.rangeFrom)}&to=${encodeURIComponent(scope.rangeTo)}`;

/** The summary's order filters: dates, staff, channel and payment method. */
const orderQuery = (scope: FinanceQueryScope) =>
  [
    dateQuery(scope),
    scope.staffId && `staffId=${encodeURIComponent(scope.staffId)}`,
    scope.channel && `channel=${encodeURIComponent(scope.channel)}`,
    scope.paymentMethod && `paymentMethod=${encodeURIComponent(scope.paymentMethod)}`,
  ]
    .filter(Boolean)
    .join("&");

const orderKey = (scope: FinanceQueryScope) => [
  scope.storeId,
  scope.rangeFrom,
  scope.rangeTo,
  scope.staffId,
  scope.channel,
  scope.paymentMethod,
];

export const salesPatternsQuery = (scope: FinanceQueryScope) => ({
  queryKey: ["finance-sales-patterns", ...orderKey(scope)],
  queryFn: () =>
    apiClient.get<SalesPatternsData>(`${base(scope)}/sales-patterns?${orderQuery(scope)}`),
});

export const adjustmentsQuery = (scope: FinanceQueryScope) => ({
  queryKey: ["finance-adjustments", ...orderKey(scope)],
  queryFn: () => apiClient.get<AdjustmentsData>(`${base(scope)}/adjustments?${orderQuery(scope)}`),
});

export const taxQuery = (scope: FinanceQueryScope) => ({
  queryKey: ["finance-tax", ...orderKey(scope)],
  queryFn: () => apiClient.get<TaxData>(`${base(scope)}/tax?${orderQuery(scope)}`),
});

/** Dates only: hours and pay rates have no channel or payment method. */
export const labourQuery = (scope: FinanceQueryScope) => ({
  queryKey: ["finance-labour", scope.storeId, scope.rangeFrom, scope.rangeTo],
  queryFn: () => apiClient.get<LabourData>(`${base(scope)}/labour?${dateQuery(scope)}`),
});
