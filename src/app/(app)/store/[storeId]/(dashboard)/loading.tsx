"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";

/**
 * Route-level loading fallback for every page under (dashboard).
 *
 * Without a loading.tsx anywhere in this subtree, each dashboard navigation
 * was a fully blocking RSC round-trip: React had nothing to show while the
 * next segment streamed, so the router simply held the *previous* page on
 * screen until the whole payload landed — and on a slow/flaky in-store
 * connection that read as a frozen tab, which is what pushes people into a
 * manual reload (and, in the installed PWA, into a hard navigation that loses
 * the client router entirely). This file is the Suspense boundary that was
 * missing: the moment a link is clicked the shell repaints with this skeleton
 * and the app visibly stays alive.
 *
 * It deliberately fills ONLY the inner scrollable content region — PageShell's
 * Topbar and Sidebar sit above this boundary in (dashboard)/layout.tsx and
 * persist across navigation, so redrawing them here would flash chrome that
 * never actually went away.
 *
 * The layout is intentionally generic (header → stat row → list card) rather
 * than page-specific: it's the shape most dashboard pages share, and a rough
 * match that appears instantly beats a pixel-perfect one per route. It's held
 * at reduced opacity because it renders on *every* navigation — at full
 * contrast the repeated flash of blocks reads as the page breaking rather
 * than the page arriving.
 */
export default function DashboardLoading() {
  const { t } = useI18n();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-0 w-full flex-1 flex-col gap-4 opacity-60 md:gap-6"
    >
      <span className="sr-only">{t("common.loadingContent")}</span>

      {/* Page header: title + subtitle stacked on mobile, actions beside them from sm up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 sm:h-7 sm:w-56" />
          <Skeleton className="h-3.5 w-52 sm:w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md sm:w-32" />
        </div>
      </div>

      {/* Summary metric row — 2-up on phones, 4-up on desktop */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-3 md:p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24 md:h-7 md:w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Main content card: filter bar above a list/table body. min-h-0 lets it
        shrink inside PageShell's overflow chain instead of forcing the page
        taller than the viewport while the real content is still in flight. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl border p-3 md:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full sm:max-w-xs" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="hidden h-3.5 w-16 sm:block" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
