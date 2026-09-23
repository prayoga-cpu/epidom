import type { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api/client";

/**
 * Back Office cache keys. Deliberately NOT the POS keys: the till fetches only
 * the ACTIVE presets (`["pos", "discount-presets", storeId]`), this tab fetches
 * every preset including switched-off ones. Sharing a key would let one page's
 * list overwrite the other's.
 */
export const promotionKeys = {
  presets: (storeId: string) => ["promotions", "presets", storeId] as const,
  coupons: (storeId: string) => ["promotions", "coupons", storeId] as const,
  loyalty: (storeId: string) => ["promotions", "loyalty-settings", storeId] as const,
};

/**
 * Retry a blip, never a verdict. A 4xx (above all the 403 that means "upgrade
 * your plan") is the server's final answer, and retrying it would keep the
 * upgrade prompt hidden behind seconds of spinner. The app-wide default retries
 * everything once. `error` is typed `Error` (TanStack's default TError) — typing
 * it `unknown` would widen every query that uses this to TError = unknown.
 */
export function retryTransientOnly(failureCount: number, error: Error): boolean {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 2;
}

/**
 * Editing a preset or the loyalty rules here must also refresh what the POS
 * cart has cached, or an owner who saves and jumps straight into POS Mode would
 * still see the old list for up to its staleTime. The keys are the POS hooks'
 * (src/features/pos/hooks/use-discount-presets.ts, use-loyalty-settings.ts); a
 * mismatch is harmless — it just invalidates nothing.
 */
export function invalidatePosCaches(
  queryClient: QueryClient,
  storeId: string,
  which: "presets" | "loyalty"
) {
  const key = which === "presets" ? "discount-presets" : "loyalty-settings";
  return queryClient.invalidateQueries({ queryKey: ["pos", key, storeId] });
}

/** Optimistic-update helper: merge a partial body into a cached row, skipping undefined keys. */
export function applyPatch<T extends object>(row: T, patch: Partial<T>): T {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return { ...row, ...defined };
}
