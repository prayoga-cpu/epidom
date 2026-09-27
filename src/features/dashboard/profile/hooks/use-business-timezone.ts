"use client";

import { useQuery } from "@tanstack/react-query";

export const businessTimezoneKeys = {
  all: ["business-timezone"] as const,
  detail: (businessId: string) => [...businessTimezoneKeys.all, businessId] as const,
};

/**
 * The business's timezone (Business.timezone) from GET /api/user/business.
 *
 * Only needed while the profile data lacks it: the Profile pages seed
 * useProfile with a server-built object that has no `business.timezone`
 * (GET /api/user/profile does carry it, so it appears after any refetch).
 * Pass `enabled: false` once the profile has it.
 */
export function useBusinessTimezone(businessId: string | undefined, enabled: boolean) {
  return useQuery<string | null>({
    queryKey: businessTimezoneKeys.detail(businessId ?? "none"),
    queryFn: async () => {
      const response = await fetch("/api/user/business");
      if (!response.ok) throw new Error("Failed to load business");
      const result = await response.json();
      const timezone = result?.data?.timezone;
      return typeof timezone === "string" && timezone ? timezone : null;
    },
    enabled: enabled && !!businessId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
