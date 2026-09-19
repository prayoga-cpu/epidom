import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CouponValidationDto, ValidateCouponBody } from "@/types/api/cashier";

/**
 * Ask the server whether a coupon code applies to the cart right now, and what
 * it would take off. The route always answers HTTP 200 — `valid` and `reason`
 * carry the verdict, so a rejected code is a resolved mutation, not an error;
 * only a network/server failure rejects.
 *
 * `itemsTotal` is the cart's item total (sum of lines, before any discount or
 * charge) in the store's literal currency. The advisory answer is re-checked by
 * the order transaction — a valid preview never guarantees the last use.
 */
export function useValidateCoupon(storeId: string) {
  return useMutation({
    mutationFn: (body: ValidateCouponBody) =>
      apiClient.post<CouponValidationDto>(`/stores/${storeId}/coupons/validate`, body),
  });
}
