"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listTableQueue,
  removeFromTableQueue,
  incrementTableQueueAttempts,
  tableQueueSize,
} from "@/lib/pwa/offline-table-queue";
import { apiClient } from "@/lib/api/client";
import { setLastSyncedAt } from "@/lib/pwa/sync-status";
import { replayQueue } from "@/lib/pwa/replay-queue";
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

  const syncingRef = useRef(false);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = await listTableQueue();
    const mine = queue.filter((e) => e.storeId === storeId);
    if (mine.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    let conflicted = 0;
    let synced = 0;

    try {
      // A dropped connection or a 5xx ends the pass and costs no attempt (see
      // replayQueue). Only a real refusal counts — and a table's state goes
      // stale, so at MAX_ATTEMPTS it's dropped rather than parked: replaying
      // "seat table 4" an hour later is worse than not replaying it.
      ({ synced } = await replayQueue(mine, {
        send: (entry) =>
          apiClient.patch(`/stores/${storeId}/tables/${entry.tableId}`, {
            status: entry.status,
            expectedStatus: entry.expectedStatus,
          }),
        remove: (entry) => removeFromTableQueue(entry.id),
        reject: async (entry, failure) => {
          if (failure.status === 409) {
            await removeFromTableQueue(entry.id);
            conflicted++;
          } else if (entry.attempts + 1 >= MAX_ATTEMPTS) {
            await removeFromTableQueue(entry.id);
          } else {
            await incrementTableQueueAttempts(entry);
          }
          return { parked: false };
        },
      }));
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }

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
  }, [storeId, queryClient, refreshCount, t]);

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
