"use client";

import { useQuery } from "@tanstack/react-query";
import type { SetupProgress } from "@/lib/guide/contracts";
import type { ApiSuccessResponse } from "@/types/api/responses";
import { UnauthorizedError, isUnauthorizedError } from "@/lib/api/unauthorized";

/**
 * The store's Getting-started checklist (GET /api/stores/[id]/setup-progress).
 *
 * Every item ticks itself off from real data, and nothing invalidates this
 * query when those items change, so it refetches on EVERY mount and window
 * focus, fresh or not ("always", not TanStack's stale-only `true`): add a menu
 * item in another tab, or do a task and press Back to the dashboard, and the
 * row is already ticked, even within staleTime of the last read.
 *
 * `data` is null when the server refuses this viewer (403 — a cashier persona,
 * a linked staff account, another business's store): render nothing, and don't
 * retry. A 401 is an UnauthorizedError (not retried); other failures are an
 * error the dashboard can simply leave out.
 */

export const setupProgressKey = (storeId: string) => ["setup-progress", storeId] as const;

export function useSetupProgress(
  storeId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery<SetupProgress | null>({
    queryKey: setupProgressKey(storeId ?? ""),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId!)}/setup-progress`);
      if (response.status === 403) return null;
      if (response.status === 401) throw new UnauthorizedError();
      if (!response.ok) throw new Error("Failed to load the setup checklist");
      const body: ApiSuccessResponse<SetupProgress> = await response.json();
      return body.data;
    },
    enabled: enabled && !!storeId,
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 1,
  });
}
