"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";
import { useI18n } from "@/components/lang/i18n-provider";
import { logger } from "@/lib/logger";
import { isStaleChunkError, reloadForStaleChunk } from "@/lib/utils/stale-chunk-reload";

/**
 * Route-level error boundary for every page under (dashboard).
 *
 * The class-based <ErrorBoundary> in (dashboard)/layout.tsx only catches what
 * throws during *client* render; a server component that fails, or an RSC
 * payload that never arrives on flaky in-store wifi, is a router-level failure
 * and blows straight past it. With nothing here to catch that, Next falls back
 * to a hard navigation and the user is left staring at a broken page with no
 * option but a manual reload. This boundary is the recovery path: it sits
 * inside the layout (same segment ⇒ nested below it), so Topbar, Sidebar and
 * the i18n provider all survive and only the content region is replaced.
 */
export default function DashboardError({
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
    logger.error("Dashboard route error boundary caught an error", error, {
      digest: error.digest,
    });

    // Every deploy rotates the content hashes under _next/static/chunks/, so a
    // tab left open across one requests URLs that no longer exist. When that
    // failure happens inside a route transition it surfaces *here* rather than
    // in ChunkErrorReloader's global listeners — and it isn't a real fault,
    // just a stale tab, so recover the same way src/components/error-boundary
    // .tsx does instead of showing an error the user can't act on.
    // reloadForStaleChunk() is cooldown-guarded (and defers while offline), and
    // returns false when it declines — in which case we fall through to the
    // recoverable card below rather than pretending a reload is coming.
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
          label: t("common.routeError.backToDashboard"),
          icon: <Home />,
          href: storeId ? `/store/${storeId}/home` : "/",
        },
      ]}
      // Next hashes the real server-side message into `digest` in production:
      // surfacing it is the only way a merchant can quote something that ties
      // their report to a line in the Vercel logs.
      reference={
        error.digest ? `${t("common.routeError.errorReference")}: ${error.digest}` : undefined
      }
    />
  );
}
