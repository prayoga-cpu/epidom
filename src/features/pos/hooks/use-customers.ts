import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  CreateCustomerBody,
  CustomerDetailDto,
  CustomerListDto,
  CustomerRowDto,
} from "@/types/api/cashier";
import type { CartCustomer } from "../types/pos.types";

/** How many matches the POS customer picker shows — it is a quick picker, not a browser. */
export const CUSTOMER_SEARCH_LIMIT = 8;

/** The snapshot the cart carries for the attached customer. */
export function toCartCustomer(
  c: Pick<CustomerRowDto, "id" | "name" | "phone" | "email" | "points" | "lifetimeSpend">
): CartCustomer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    points: c.points,
    lifetimeSpend: c.lifetimeSpend,
  };
}

/**
 * Search-as-you-type for the inline customer row. The caller debounces `query`
 * (~250ms) so this fires once per pause, not per keystroke. An empty query is
 * valid — the server returns its default first page, which is what the cashier
 * sees the moment the row expands.
 *
 * keepPreviousData: between keystrokes the last list stays on screen instead of
 * flashing empty, which on a tablet reads as the picker glitching.
 */
export function useCustomerSearch(storeId: string, query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: ["pos", "customers", storeId, "search", q],
    queryFn: () =>
      apiClient.get<CustomerListDto>(`/stores/${storeId}/customers`, {
        q,
        limit: String(CUSTOMER_SEARCH_LIMIT),
      }),
    enabled: !!storeId && enabled,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** One customer with fresh points and lifetime spend — never trust a persisted snapshot's balance. */
export function fetchCustomerDetail(storeId: string, customerId: string) {
  return apiClient.get<CustomerDetailDto>(`/stores/${storeId}/customers/${customerId}`);
}

export function useCustomerDetail(storeId: string, customerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["pos", "customers", storeId, "detail", customerId],
    queryFn: () => fetchCustomerDetail(storeId, customerId as string),
    enabled: !!storeId && !!customerId && enabled,
    // Always re-read on mount: the point of this query is to replace a balance
    // that was persisted in localStorage, possibly days ago.
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
}

/** POS quick-create. A duplicate phone in the store comes back as a 409 ApiClientError. */
export function useCreateCustomer(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCustomerBody) =>
      apiClient.post<CustomerRowDto>(`/stores/${storeId}/customers`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "customers", storeId, "search"] });
    },
  });
}
