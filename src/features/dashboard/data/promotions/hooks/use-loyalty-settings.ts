import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { LoyaltySettingsDto } from "@/types/api/cashier";
import { invalidatePosCaches, promotionKeys, retryTransientOnly } from "./promotion-keys";

/**
 * The store's loyalty rules. GET resolves a full object even for a store that
 * never configured it (`enabled: false`, amounts 0) — never null. OPERATIONS-
 * gated server-side. `spendPerPoint` / `pointValue` are literal amounts in the
 * store's currency.
 */
export function useLoyaltySettings(storeId: string) {
  return useQuery({
    queryKey: promotionKeys.loyalty(storeId),
    queryFn: () => apiClient.get<LoyaltySettingsDto>(`/stores/${storeId}/loyalty-settings`),
    enabled: !!storeId,
    retry: retryTransientOnly,
  });
}

/**
 * PUT any subset of the settings. Enabling requires spendPerPoint > 0 AND
 * pointValue > 0 — otherwise a 400 whose `error.details` names the field.
 * `retry: false`: see use-discount-presets.ts.
 */
export function useUpdateLoyaltySettings(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (body: Partial<LoyaltySettingsDto>) =>
      apiClient.put<LoyaltySettingsDto>(`/stores/${storeId}/loyalty-settings`, body),
    onSuccess: (settings) => {
      queryClient.setQueryData(promotionKeys.loyalty(storeId), settings);
      void invalidatePosCaches(queryClient, storeId, "loyalty");
    },
  });
}
