import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { DiscountPresetDto } from "@/types/api/cashier";

/**
 * The store's active discount presets (Back Office → Data → Promotions).
 *
 * `enabled` must be false below the OPERATIONS plan — the route enforces the
 * gate server-side, so an ungated call would just be a 403 in the console. The
 * discount dialog degrades silently to its manual section when this is empty
 * or errored: presets are a convenience, never a reason to block a discount.
 *
 * Money in a FIXED preset is literal in the store's currency (never IDR).
 */
export function useDiscountPresets(storeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pos", "discount-presets", storeId],
    queryFn: () => apiClient.get<DiscountPresetDto[]>(`/stores/${storeId}/discount-presets`),
    enabled: !!storeId && enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}
