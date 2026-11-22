"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Monitor, RefreshCw } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";
import { useI18n } from "@/components/lang/i18n-provider";
import { logger } from "@/lib/logger";
import { isStaleChunkError, reloadForStaleChunk } from "@/lib/utils/stale-chunk-reload";

/**
 * Route-level error boundary for every page under (pos-mode) — same recovery
 * logic as (dashboard)/error.tsx (stale-chunk reload, then a recoverable
 * card), adapted so the "back to safety" link lands on the cashier screen
 * rather than /dashboard: POS Mode's audience (Cashier/Kitchen) has no
 * Back Office access to land on.
 */
export default function PosModeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, locale } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string | undefined;
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    logger.error("POS Mode route error boundary caught an error", error, {
      digest: error.digest,
    });

    if (error.name === "ChunkLoadError" || isStaleChunkError(error.message)) {
      setRecovering(reloadForStaleChunk());
    }
  }, [error]);

  if (recovering) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <RefreshCw
            className="text-epi-gold-600 dark:text-epi-gold-400 size-4 shrink-0 motion-safe:animate-spin"
            aria-hidden="true"
          />
          {t("common.routeError.recovering")}
        </p>
      </div>
    );
  }

  // Inside the app shell (topbar and sidebar survive), so the "app" tone: a card
  // on the themed tokens, right in light and dark mode, with the gold accent.
  return (
    <StatusScreen
      tone="app"
      layout="fill"
      locale={locale}
      announce
      // The shell above keeps the page's own <h1>.
      headingLevel="h2"
      icon={<AlertTriangle />}
      eyebrow={t("statusPages.error.eyebrow")}
      title={t("common.routeError.title")}
      description={t("common.routeError.description")}
      hint={t("common.routeError.offlineHint")}
      details={
        process.env.NODE_ENV === "development" ? (
          <pre className="m-0 max-h-48 overflow-auto text-xs break-words whitespace-pre-wrap">
            {error.message}
          </pre>
        ) : undefined
      }
      actions={[
        { label: t("common.routeError.tryAgain"), icon: <RefreshCw />, onClick: reset },
        {
          label: t("nav.pos"),
          icon: <Monitor />,
          href: storeId ? `/store/${storeId}/pos` : "/",
        },
      ]}
      reference={
        error.digest ? `${t("common.routeError.errorReference")}: ${error.digest}` : undefined
      }
    />
  );
}
