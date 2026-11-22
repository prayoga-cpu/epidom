"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";

/**
 * The Operational page's own loading shape — a tab strip over a panel — so the
 * till-shaped skeleton in (pos-mode)/loading.tsx doesn't flash while the tab
 * bar is already gone for this route.
 */
export default function PosModeOperationalLoading() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden opacity-60"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div className="shrink-0 border-b px-3 py-2 md:px-6">
        <Skeleton className="h-11 w-full rounded-lg sm:w-96" />
      </div>
      <div className="space-y-3 p-4 md:p-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </div>
  );
}
