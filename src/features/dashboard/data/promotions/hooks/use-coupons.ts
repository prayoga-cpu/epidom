import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CouponDto, CreateCouponBody, UpdateCouponBody } from "@/types/api/cashier";
import { applyPatch, promotionKeys, retryTransientOnly } from "./promotion-keys";

/**
 * Every coupon, newest first, including switched-off ones, each with its
 * `usedCount`. OPERATIONS-gated server-side (403 SUBSCRIPTION_FEATURE_LOCKED
 * below it). Amounts are literal in the store's currency; dates are ISO strings.
 */
export function useCoupons(storeId: string) {
  return useQuery({
    queryKey: promotionKeys.coupons(storeId),
    queryFn: () => apiClient.get<CouponDto[]>(`/stores/${storeId}/coupons`),
    enabled: !!storeId,
    retry: retryTransientOnly,
  });
}

// `retry: false` on mutations — see use-discount-presets.ts.

/** A duplicate code is a 409 whose `error.details` names the `code` field. */
export function useCreateCoupon(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (body: CreateCouponBody) =>
      apiClient.post<CouponDto>(`/stores/${storeId}/coupons`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.coupons(storeId) });
    },
  });
}

export interface UpdateCouponVariables {
  id: string;
  /** Never carries `code` — it is immutable and the server rejects a body that includes one. */
  body: UpdateCouponBody;
}

/** PATCH with an optimistic write so the active Switch responds instantly; rolled back on failure. */
export function useUpdateCoupon(storeId: string) {
  const queryClient = useQueryClient();
  const key = promotionKeys.coupons(storeId);
  return useMutation({
    retry: false,
    mutationFn: ({ id, body }: UpdateCouponVariables) =>
      apiClient.patch<CouponDto>(`/stores/${storeId}/coupons/${id}`, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CouponDto[]>(key);
      queryClient.setQueryData<CouponDto[]>(key, (rows) =>
        rows?.map((row) => (row.id === id ? applyPatch<CouponDto>(row, body) : row))
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
