"use client";

import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineSyncContext } from "@/features/dashboard/shared/offline-sync-provider";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

export function PosOfflineBanner() {
  const { t, formatDateTime } = useI18n();
  const [isOnline, setIsOnline] = useState(true);
  const { pendingCount, isSyncing, syncNow, lastSyncedAt } = useOfflineSyncContext();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
        isOnline
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <CloudUpload className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <div className="flex flex-col">
          <span>
            {!isOnline
              ? pendingCount > 0
                ? t("pages.posOfflineMessageWithPending").replace("{count}", String(pendingCount))
                : t("pages.posOfflineMessageNoPending")
              : t("pages.posOfflineSyncPending").replace("{count}", String(pendingCount))}
          </span>
          {!isOnline && (
            <span className="text-xs font-normal opacity-80">
              {lastSyncedAt
                ? t("pages.posOfflineLastSynced").replace("{date}", formatDateTime(lastSyncedAt))
                : t("pages.posOfflineNeverSynced")}
            </span>
          )}
        </div>
      </div>

      {isOnline && pendingCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs"
          onClick={syncNow}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? t("pages.posOfflineSyncing") : t("pages.posOfflineSyncNow")}
        </Button>
      )}
    </div>
  );
}
