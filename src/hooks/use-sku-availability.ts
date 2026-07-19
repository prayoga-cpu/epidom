"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./use-debounce";

export type SkuAvailabilityStatus = "idle" | "checking" | "available" | "taken";

/**
 * Debounced live SKU-availability check against a store-scoped check-sku
 * endpoint (e.g. /api/stores/{id}/materials/check-sku), mirroring the
 * storefront-slug availability pattern. Shared across the Material and
 * Product add/edit dialogs instead of duplicating the debounce+fetch logic.
 *
 * @param endpoint Full check-sku URL for the current store, e.g.
 *   `/api/stores/${storeId}/materials/check-sku`
 * @param sku Current SKU field value
 * @param excludeId The item's own id in edit mode, so its own SKU doesn't flag as taken
 */
export function useSkuAvailability(
  endpoint: string,
  sku: string,
  excludeId?: string
): { status: SkuAvailabilityStatus } {
  const debouncedSku = useDebounce(sku, 500);
  const trimmed = debouncedSku.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["sku-availability", endpoint, trimmed, excludeId],
    queryFn: async () => {
      const params = new URLSearchParams({ sku: trimmed });
      if (excludeId) params.set("excludeId", excludeId);
      const res = await fetch(`${endpoint}?${params.toString()}`);
      const json = await res.json();
      return json?.data as { available: boolean; reason: string | null } | undefined;
    },
    enabled: trimmed.length > 0,
    staleTime: 10_000,
  });

  const status: SkuAvailabilityStatus =
    trimmed.length === 0
      ? "idle"
      : isFetching
        ? "checking"
        : data?.available === true
          ? "available"
          : data?.available === false
            ? "taken"
            : "idle";

  return { status };
}
