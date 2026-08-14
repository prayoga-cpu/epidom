"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Download,
  Loader2,
  Minus,
  RefreshCw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatFileSize } from "@/lib/utils/formatting";
import {
  OFFLINE_PAGES,
  collectOfflineDataStatus,
  getServiceWorkerOfflineStatus,
  isServiceWorkerControlling,
  offlinePagePath,
  offlinePagePaths,
  warmOfflineShell,
  type OfflineDomainStatus,
  type ServiceWorkerOfflineStatus,
  type WarmShellReply,
} from "@/lib/pwa/offline-status";

/**
 * "Which pages and which data actually work without a connection, on this
 * device, right now."
 *
 * This exists because every previous answer the app gave was a promise rather
 * than a report: a switch labelled Offline Mode said only that someone had
 * turned it on. It could not distinguish a fully mirrored tablet from one where
 * the service worker had never taken control, where the page shells were never
 * saved, or where offline caching is switched off entirely (localhost) — three
 * very different reasons for "I tested offline and it didn't work", each with a
 * different fix, and none of them visible anywhere.
 *
 * Every row is read from the real source: page rows from the service worker's
 * own shell cache, data rows from the live query cache the persister
 * dehydrates. Nothing here is inferred from the Offline Mode flag.
 */
export function OfflineReadiness({
  storeId,
  offlineModeEnabled,
  isPriming,
}: {
  storeId: string;
  offlineModeEnabled: boolean;
  isPriming: boolean;
}) {
  const { t, formatRelativeTime } = useI18n();
  const queryClient = useQueryClient();

  const [swStatus, setSwStatus] = useState<ServiceWorkerOfflineStatus | null>(null);
  const [swChecked, setSwChecked] = useState(false);
  const [controlling, setControlling] = useState(true);
  const [dataStatus, setDataStatus] = useState<OfflineDomainStatus[]>([]);
  const [storage, setStorage] = useState<{
    usage: number;
    quota: number;
    persisted: boolean;
  } | null>(null);
  const [isWarming, setIsWarming] = useState(false);
  const [lastWarm, setLastWarm] = useState<WarmShellReply | null>(null);

  const refresh = useCallback(async () => {
    setDataStatus(collectOfflineDataStatus(queryClient, storeId));
    setControlling(isServiceWorkerControlling());
    setSwStatus(await getServiceWorkerOfflineStatus());
    setSwChecked(true);

    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const persisted = navigator.storage.persisted
          ? await navigator.storage.persisted().catch(() => false)
          : false;
        setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted });
      } catch {
        setStorage(null);
      }
    }
  }, [queryClient, storeId]);

  // Re-read whenever priming finishes, so the rows reflect the sync that just
  // ran rather than the state from before it.
  useEffect(() => {
    void refresh();
  }, [refresh, isPriming]);

  const warm = useCallback(async () => {
    setIsWarming(true);
    try {
      setLastWarm(await warmOfflineShell(offlinePagePaths(storeId)));
    } finally {
      setIsWarming(false);
      await refresh();
    }
  }, [storeId, refresh]);

  const shellPaths = swStatus?.shellPaths ?? [];
  const devPassthrough = swStatus?.devPassthrough ?? false;
  const readyPages = OFFLINE_PAGES.filter((page) =>
    shellPaths.includes(offlinePagePath(storeId, page))
  ).length;
  const readyDomains = dataStatus.filter((domain) => domain.ready).length;
  // A page cached but not yet controlled by a worker is not openable offline,
  // so the headline count has to collapse to zero rather than read as ready.
  const pagesUsable = controlling && !devPassthrough;
  const authExpired = lastWarm?.results.some((result) => result.reason === "auth") ?? false;

  return (
    <div className="space-y-4">
      {/* ── Blockers ─────────────────────────────────────────────────────
          Ordered by how completely each one defeats offline: dev passthrough
          means nothing is ever served from cache, no controller means the
          worker isn't in the request path yet. */}
      {swChecked && devPassthrough && (
        <Notice tone="warning" icon={<AlertTriangle className="size-4 shrink-0" />}>
          {t("common.pwa.devPassthroughWarning")}
        </Notice>
      )}
      {swChecked && !controlling && (
        <Notice tone="warning" icon={<CloudOff className="size-4 shrink-0" />}>
          {t("common.pwa.workerNotControlling")}
        </Notice>
      )}
      {authExpired && (
        <Notice tone="warning" icon={<AlertTriangle className="size-4 shrink-0" />}>
          {t("common.pwa.warmAuthExpired")}
        </Notice>
      )}

      {/* ── Pages ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("common.pwa.pagesTitle")}</h3>
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("common.pwa.readyOf")
              .replace("{ready}", String(pagesUsable ? readyPages : 0))
              .replace("{total}", String(OFFLINE_PAGES.length))}
          </span>
        </header>
        <p className="text-muted-foreground text-xs">{t("common.pwa.pagesIntro")}</p>

        <ul className="divide-border divide-y rounded-md border">
          {OFFLINE_PAGES.map((page) => {
            const saved = shellPaths.includes(offlinePagePath(storeId, page));
            return (
              <li key={page.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{t(`common.pwa.page.${page.id}`)}</p>
                  {page.domains.length === 0 && (
                    <p className="text-muted-foreground truncate text-[11px]">
                      {t("common.pwa.shellOnly")}
                    </p>
                  )}
                </div>
                <StatusBadge
                  state={!swChecked ? "unknown" : saved && pagesUsable ? "ready" : "missing"}
                  readyLabel={t("common.pwa.statusReady")}
                  missingLabel={t("common.pwa.statusMissing")}
                  unknownLabel={t("common.pwa.statusUnknown")}
                />
              </li>
            );
          })}
        </ul>

        {offlineModeEnabled && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full gap-2 text-xs"
            onClick={warm}
            disabled={isWarming || isPriming || devPassthrough}
          >
            {isWarming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {isWarming ? t("common.pwa.savingPages") : t("common.pwa.savePages")}
          </Button>
        )}
      </section>

      {/* ── Data ──────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("common.pwa.dataTitle")}</h3>
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("common.pwa.readyOf")
              .replace("{ready}", String(readyDomains))
              .replace("{total}", String(dataStatus.length))}
          </span>
        </header>
        <p className="text-muted-foreground text-xs">{t("common.pwa.dataIntro")}</p>

        <ul className="divide-border divide-y rounded-md border">
          {dataStatus.map((domain) => (
            <li key={domain.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{t(`common.pwa.data.${domain.id}`)}</p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {domain.ready
                    ? [
                        t("common.pwa.recordCount").replace("{count}", String(domain.itemCount)),
                        domain.updatedAt
                          ? t("common.pwa.updatedAgo").replace(
                              "{time}",
                              formatRelativeTime(domain.updatedAt)
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : t("common.pwa.notCachedHint")}
                </p>
              </div>
              <StatusBadge
                state={domain.ready ? (domain.stale ? "stale" : "ready") : "missing"}
                readyLabel={t("common.pwa.statusReady")}
                missingLabel={t("common.pwa.statusMissing")}
                unknownLabel={t("common.pwa.statusUnknown")}
                staleLabel={t("common.pwa.statusStale")}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Device ────────────────────────────────────────────────────── */}
      <section className="text-muted-foreground space-y-1 border-t pt-3 text-[11px]">
        {storage && storage.quota > 0 && (
          <p>
            {t("common.pwa.storageUsage")
              .replace("{used}", formatFileSize(storage.usage))
              .replace("{quota}", formatFileSize(storage.quota))}
          </p>
        )}
        {storage && (
          <p>
            {storage.persisted
              ? t("common.pwa.storagePersisted")
              : t("common.pwa.storageNotPersisted")}
          </p>
        )}
        {swStatus && (
          <p>
            {t("common.pwa.workerVersion")
              .replace("{version}", swStatus.cacheVersion)
              .replace("{assets}", String(swStatus.assetCount))}
          </p>
        )}
        <Button variant="ghost" size="sm" className="h-10 gap-1 px-2 text-[11px]" onClick={refresh}>
          <RefreshCw className="size-3" />
          {t("common.pwa.recheck")}
        </Button>
      </section>
    </div>
  );
}

/** Inline warning row. Kept local — nothing else in the app needs this shape. */
function Notice({
  tone,
  icon,
  children,
}: {
  tone: "warning";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200"
          : ""
      }
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function StatusBadge({
  state,
  readyLabel,
  missingLabel,
  unknownLabel,
  staleLabel,
}: {
  state: "ready" | "missing" | "unknown" | "stale";
  readyLabel: string;
  missingLabel: string;
  unknownLabel: string;
  staleLabel?: string;
}) {
  if (state === "ready") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      >
        <Check className="size-3" />
        {readyLabel}
      </Badge>
    );
  }
  if (state === "stale") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="size-3" />
        {staleLabel ?? readyLabel}
      </Badge>
    );
  }
  if (state === "unknown") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Minus className="size-3" />
        {unknownLabel}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <X className="size-3" />
      {missingLabel}
    </Badge>
  );
}
