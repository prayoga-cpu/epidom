"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiSuccessResponse } from "@/types/api/responses";

interface StorefrontLink {
  slug: string | null;
  isPublished: boolean;
}

/**
 * The store's public Phone Orders path ("/@slug"), or null while it is
 * loading, unreadable (a refused or failed read), unpublished or missing: a
 * link to a page that 404s is worse than no link. Cached for a few minutes;
 * the slug rarely changes and the caller is a menu on a till.
 */
export function useStorefrontLink(storeId: string | null | undefined): string | null {
  const { data } = useQuery<StorefrontLink | null>({
    queryKey: ["storefront-link", storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId!)}/storefront/link`);
      if (!response.ok) return null;
      const body: ApiSuccessResponse<StorefrontLink> = await response.json();
      return body.data;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data?.slug && data.isPublished ? `/@${data.slug}` : null;
}
