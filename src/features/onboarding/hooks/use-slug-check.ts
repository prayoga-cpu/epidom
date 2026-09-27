"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { isValidStoreSlug } from "../lib/store-link";
import { onboardingApi } from "../lib/onboarding-api";

export const SLUG_CHECK_DEBOUNCE_MS = 400;

export type SlugCheckStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

export interface SlugCheck {
  status: SlugCheckStatus;
  /** A free alternative when the link is taken. */
  suggestion: string | null;
}

export const slugCheckKey = (slug: string) => ["onboarding", "slug-check", slug] as const;

/**
 * Whether a store link is free (GET /api/onboarding/slug-check), checked
 * 400 ms after the owner stops typing. `slug` should already be normalized
 * (slugifyStoreLink); a value shorter than 3 characters is "invalid" without
 * asking the server. The owner's own current link counts as available.
 */
export function useSlugCheck(
  slug: string,
  { enabled = true }: { enabled?: boolean } = {}
): SlugCheck {
  const debounced = useDebounce(slug, SLUG_CHECK_DEBOUNCE_MS);
  const settled = debounced === slug;
  const valid = isValidStoreSlug(debounced);

  const query = useQuery({
    queryKey: slugCheckKey(debounced),
    queryFn: ({ signal }) => onboardingApi.checkSlug(debounced, signal),
    enabled: enabled && valid,
    staleTime: 30 * 1000,
    retry: false,
  });

  if (!enabled || !slug) return { status: "idle", suggestion: null };
  if (!settled) return { status: "checking", suggestion: null };
  if (!valid) return { status: "invalid", suggestion: null };
  if (query.isError) return { status: "error", suggestion: null };
  if (!query.data) return { status: "checking", suggestion: null };
  if (query.data.available) return { status: "available", suggestion: null };
  return query.data.suggestion
    ? { status: "taken", suggestion: query.data.suggestion }
    : { status: "invalid", suggestion: null };
}
