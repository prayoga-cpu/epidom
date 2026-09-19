import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { LoyaltySettingsDto } from "@/types/api/cashier";

/**
 * The store's loyalty rules. GET always resolves defaults (never null), so
 * "loyalty is off" arrives as `enabled: false`, not as a missing row.
 *
 * `enabled` must be false below the OPERATIONS plan (the route is gated
 * server-side — an ungated call is a 403 in the console) and while offline
 * (points are an online-only feature). PosCart feeds the result to
 * `cart.setLoyaltyRules`, which the cart's redemption math reads.
 *
 * spendPerPoint / pointValue are literal amounts in the store's currency.
 */
export function useLoyaltySettings(storeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pos", "loyalty-settings", storeId],
    queryFn: () => apiClient.get<LoyaltySettingsDto>(`/stores/${storeId}/loyalty-settings`),
    enabled: !!storeId && enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}
