"use client";

import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import { normalizeDefaultLanding } from "@/lib/last-visited";

/**
 * The user's preferred section to land on when entering a store. Reads from the
 * shared ["profile", userId] cache (same source as the currency provider), so it
 * doesn't add a duplicate request. Resolved by normalizeDefaultLanding, the
 * same rule the store index page uses: Home unless "pos", "storefront" or
 * "data" was chosen.
 */
export function useDefaultLanding(): string {
  const { user } = useUser();

  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () =>
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => (d?.success && d?.data ? d.data : d)),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    select: (d: any): string => {
      const v = typeof d === "string" ? d : (d?.defaultLanding ?? d?.data?.defaultLanding);
      return normalizeDefaultLanding(v);
    },
  });

  return data || "home";
}
