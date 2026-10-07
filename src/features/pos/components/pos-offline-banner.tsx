"use client";

import { useState } from "react";
import { AlertTriangle, CloudUpload, LogIn, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineSyncContext } from "@/features/dashboard/shared/offline-sync-provider";
import { useI18n } from "@/components/lang/i18n-provider";
import { OfflineQueueDialog } from "./offline-queue-review";

export function PosOfflineBanner() {
  const { t, formatDateTime } = useI18n();
  // Reachability-confirmed, not `navigator.onLine`: that one says "online" on
  // wifi whose internet is down, which is exactly when this banner matters.
  const {
    isOnline,
    pendingCount,
    attentionCount,
    needsSignIn,
    isSyncing,
    syncNow,
    lastSyncedAt,
    queuedSales,
    queuedProductionLogs,
  } = useOfflineSyncContext();
  // What the review list shows: sales and production logs (table changes aren't listed).
  const reviewable = queuedSales.length + queuedProductionLogs.length > 0;
  const [reviewOpen, setReviewOpen] = useState(false);

  if (isOnline && pendingCount === 0 && attentionCount === 0) return null;

  const urgent = !isOnline || attentionCount > 0;
  const Icon = !isOnline
    ? WifiOff
    : attentionCount > 0
      ? AlertTriangle
      : needsSignIn
        ? LogIn
        : CloudUpload;

  const message = !isOnline
    ? pendingCount > 0
      ? t("pages.posOfflineMessageWithPending").replace("{count}", String(pendingCount))
      : t("pages.posOfflineMessageNoPending")
    : attentionCount > 0
      ? t("pos.offline.needsAttentionShort").replace("{count}", String(attentionCount))
      : needsSignIn
        ? t("pos.offline.signInNeeded").replace("{count}", String(pendingCount))
        : t("pages.posOfflineSyncPending").replace("{count}", String(pendingCount));

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
          urgent
            ? "bg-destructive/10 text-destructive"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span>{message}</span>
            {!isOnline && (
              <span className="text-xs font-normal opacity-80">
                {lastSyncedAt
                  ? t("pages.posOfflineLastSynced").replace("{date}", formatDateTime(lastSyncedAt))
                  : t("pages.posOfflineNeverSynced")}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {reviewable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 text-xs"
              onClick={() => setReviewOpen(true)}
            >
              {t("pos.offline.review")}
            </Button>
          )}
          {isOnline && pendingCount > 0 && !needsSignIn && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 gap-1.5 text-xs"
              onClick={syncNow}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? t("pages.posOfflineSyncing") : t("pages.posOfflineSyncNow")}
            </Button>
          )}
        </div>
      </div>
      <OfflineQueueDialog open={reviewOpen} onOpenChange={setReviewOpen} />
    </>
  );
}
