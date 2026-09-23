"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Monitor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { t } = useI18n();
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

          {/* flex-1, never w-full: a two-button row would otherwise overflow
            by exactly one sibling's width. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset} size="lg" className="flex-1">
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("common.routeError.tryAgain")}
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href={storeId ? `/store/${storeId}/pos` : "/"}>
                <Monitor className="size-4" aria-hidden="true" />
                {t("nav.pos")}
              </Link>
            </Button>
          </div>

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
