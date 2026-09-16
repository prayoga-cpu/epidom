"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading fallback for every page under (pos-mode) — the same
 * missing-Suspense-boundary problem (dashboard)/loading.tsx documents, but
 * shaped for this shell instead of reused from it: PosModeShell's status bar
 * and tab bar persist above this boundary (see (pos-mode)/layout.tsx), not
 * PageShell's Topbar/Sidebar, so a dashboard-list-shaped skeleton would be
 * the wrong content shape here — this one is an item-grid + cart shape,
 * matching what /pos itself looks like while its data streams in.
 */
export default function PosModeLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-0 w-full flex-1 overflow-hidden opacity-60"
    >
      <span className="sr-only">Loading…</span>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-9 w-full max-w-[200px] rounded-md sm:max-w-xs" />
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>

      <div className="hidden w-80 shrink-0 flex-col gap-3 border-l p-4 md:flex lg:w-96">
        <Skeleton className="h-6 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
