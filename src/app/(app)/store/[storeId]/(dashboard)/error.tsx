"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { t } = useI18n();
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
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
          {t("common.routeError.recovering")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-2 md:p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-destructive/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
            <AlertTriangle className="text-destructive size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-lg sm:text-xl">{t("common.routeError.title")}</CardTitle>
          <CardDescription>{t("common.routeError.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-4 sm:px-6">
          <p className="text-muted-foreground text-center text-xs">
            {t("common.routeError.offlineHint")}
          </p>

          {process.env.NODE_ENV === "development" && (
            <div className="bg-destructive/10 rounded-md p-3">
              <pre className="text-destructive/80 overflow-auto text-xs whitespace-pre-wrap">
                {error.message}
              </pre>
            </div>
          )}

          {/* flex-1, never w-full: in a two-button row w-full would claim the
            whole row on top of its sibling and overflow by exactly its width. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset} size="lg" className="flex-1">
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("common.routeError.tryAgain")}
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href={storeId ? `/store/${storeId}/dashboard` : "/"}>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                {t("common.routeError.backToDashboard")}
              </Link>
            </Button>
          </div>

          {/* Next hashes the real server-side message into `digest` in
            production — surfacing it is the only way a merchant can quote
            something that ties their report to a line in the Vercel logs. */}
          {error.digest ? (
            <p className="text-muted-foreground text-center font-mono text-[11px] break-all">
              {t("common.routeError.errorReference")}: {error.digest}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
