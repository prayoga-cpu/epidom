"use client";

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listTableQueue,
  removeFromTableQueue,
  incrementTableQueueAttempts,
  tableQueueSize,
} from "@/lib/pwa/offline-table-queue";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { setLastSyncedAt } from "@/lib/pwa/sync-status";
import { useI18n } from "@/components/lang/i18n-provider";

const MAX_ATTEMPTS = 5;

/**
 * Drains the offline table-status queue. Unlike the POS order queue, a
 * replayed entry here can legitimately be *wrong* by the time it syncs — the
 * table may have been seated or freed by another terminal while this device
 * was offline. The API's `expectedStatus` guard reports that as a 409, which
 * this treats as final (drop the entry, resync the real state) rather than
 * retrying — retrying a stale expectation can never succeed and would just
 * burn attempts until MAX_ATTEMPTS silently discards it anyway.
 */
export function useOfflineTableQueue(storeId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await tableQueueSize());
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncing) return;
    const queue = await listTableQueue();
    const mine = queue.filter((e) => e.storeId === storeId);
    if (mine.length === 0) return;

    setIsSyncing(true);
    let synced = 0;
    let conflicted = 0;

    for (const entry of mine) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        await removeFromTableQueue(entry.id);
        continue;
      }

      try {
        await apiClient.patch(`/stores/${storeId}/tables/${entry.tableId}`, {
          status: entry.status,
          expectedStatus: entry.expectedStatus,
        });
        await removeFromTableQueue(entry.id);
        synced++;
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          await removeFromTableQueue(entry.id);
          conflicted++;
          continue;
        }
        await incrementTableQueueAttempts(entry);
      }
    }

    setIsSyncing(false);
    await refreshCount();

    if (synced > 0 || conflicted > 0) {
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
    }
    if (synced > 0) {
      toast.success(t("pos.offline.tablesSynced").replace("{count}", String(synced)));
      await setLastSyncedAt(storeId);
    }
    if (conflicted > 0) {
      toast(t("pos.offline.tablesConflicted").replace("{count}", String(conflicted)));
    }
  }, [isSyncing, storeId, queryClient, refreshCount, t]);

  useEffect(() => {
    refreshCount();
    if (navigator.onLine) syncQueue();
  }, [refreshCount, syncQueue]);

  useEffect(() => {
    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncQueue]);

  return { pendingCount, isSyncing, syncQueue, refreshCount };
}
