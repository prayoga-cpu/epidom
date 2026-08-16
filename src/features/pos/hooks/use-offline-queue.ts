"use client";

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listQueue,
  removeFromQueue,
  incrementAttempts,
  queueSize,
  type OfflineOrder,
} from "@/lib/pwa/offline-queue";
import { apiClient } from "@/lib/api/client";
import { setLastSyncedAt } from "@/lib/pwa/sync-status";
import { useI18n } from "@/components/lang/i18n-provider";

const MAX_ATTEMPTS = 5;

export function useOfflineQueue(storeId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const n = await queueSize();
    setPendingCount(n);
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncing) return;
    const queue = await listQueue();
    const mine = queue.filter((e) => e.storeId === storeId);
    if (mine.length === 0) return;

    setIsSyncing(true);
    let synced = 0;

    for (const entry of mine) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        await removeFromQueue(entry.id);
        continue;
      }

      try {
        // The queue entry's own id doubles as the idempotency key. Without it a
        // lost response — or a second tab flushing the same IndexedDB queue —
        // creates a duplicate order AND double-deducts the stock behind it. The
        // server returns the existing order instead of creating another.
        await apiClient.post(`/stores/${storeId}/pos/orders`, {
          ...entry.order,
          clientRequestId: entry.id,
        });
        await removeFromQueue(entry.id);
        synced++;
      } catch {
        await incrementAttempts(entry);
      }
    }

    setIsSyncing(false);
    await refreshCount();

    if (synced > 0) {
      toast.success(t("pos.offline.synced").replace("{count}", String(synced)));
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      // A push flush counts as a sync even if the pull side didn't run this
      // pass — a partial flush (some entries still retrying) still means
      // real data reached the server, so "last synced" should reflect it.
      await setLastSyncedAt(storeId);
    }
  }, [isSyncing, storeId, queryClient, refreshCount, t]);

  // Sync on initial mount (catches page reloads after reconnect)
  useEffect(() => {
    refreshCount();
    if (navigator.onLine) syncQueue();
  }, [refreshCount, syncQueue]);

  // Sync whenever the browser regains connectivity
  useEffect(() => {
    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncQueue]);

  return { pendingCount, isSyncing, syncQueue, refreshCount };
}
