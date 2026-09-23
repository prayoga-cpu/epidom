"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  AdjustPointsBody,
  CreateCustomerBody,
  CustomerDetailDto,
  CustomerRowDto,
  UpdateCustomerBody,
} from "@/types/api/cashier";
import { downloadCustomersCsv } from "../lib/download-customers-csv";
import { customerKeys } from "./use-customer-queries";

/**
 * Refreshes every cached view of this store's customers: the Back Office list,
 * summary tiles and open detail (one ["customers", storeId] prefix) AND the POS
 * picker, which caches under ["pos", "customers", storeId]. Without the second
 * call a customer added or re-pointed here would stay stale in the till's
 * search for its whole staleTime.
 */
export function invalidateCustomerQueries(queryClient: QueryClient, storeId: string) {
  queryClient.invalidateQueries({ queryKey: customerKeys.all(storeId) });
  queryClient.invalidateQueries({ queryKey: ["pos", "customers", storeId] });
}

/**
 * A duplicate phone (409) or a malformed one (400) rejects with an
 * ApiClientError whose `error.details` is `[{ field: "phone", message }]` — the
 * dialog feeds that to applyServerFieldErrors, so nothing is swallowed here.
 */
export function useCreateCustomer(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerBody) =>
      apiClient.post<CustomerRowDto>(`/stores/${storeId}/customers`, body),
    onSuccess: () => invalidateCustomerQueries(queryClient, storeId),
  });
}

export function useUpdateCustomer(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, body }: { customerId: string; body: UpdateCustomerBody }) =>
      apiClient.patch<CustomerDetailDto>(`/stores/${storeId}/customers/${customerId}`, body),
    onSuccess: (detail, { customerId }) => {
      // PATCH answers with the full detail, so seed the open drawer with it now;
      // the invalidation below then only has to reconcile, not flash stale data.
      queryClient.setQueryData(customerKeys.detail(storeId, customerId), detail);
      invalidateCustomerQueries(queryClient, storeId);
    },
  });
}

/** Owner/manager only. `points` is signed; the balance can't go below zero (400 on `points`). */
export function useAdjustPoints(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, body }: { customerId: string; body: AdjustPointsBody }) =>
      apiClient.post<CustomerRowDto>(`/stores/${storeId}/customers/${customerId}/points`, body),
    onSuccess: (row, { customerId }) => {
      // The response is the refreshed row (new balance). Fold it into the cached
      // detail so the points tile moves immediately; the ledger list still needs
      // the refetch that the invalidation triggers.
      queryClient.setQueryData<CustomerDetailDto>(
        customerKeys.detail(storeId, customerId),
        (old) => (old ? { ...old, ...row } : old)
      );
      invalidateCustomerQueries(queryClient, storeId);
    },
  });
}

/** `q` is the list's current search, so the file matches what the table shows. */
export function useExportCustomers(storeId: string) {
  return useMutation({
    mutationFn: (q: string) => downloadCustomersCsv(storeId, q),
  });
}
