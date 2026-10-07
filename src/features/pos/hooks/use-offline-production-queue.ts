"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listProductionQueue,
  removeFromProductionQueue,
  recordProductionRejection,
  requeueParkedProduction,
  type OfflineProductionLog,
} from "@/lib/pwa/offline-production-queue";
import { apiClient } from "@/lib/api/client";
import { setLastSyncedAt } from "@/lib/pwa/sync-status";
import { replayQueue, sameQueueEntries } from "@/lib/pwa/replay-queue";
import { MAX_REJECTED_ATTEMPTS } from "@/lib/pwa/sync-failure";
import { useI18n } from "@/components/lang/i18n-provider";
import { alertKeys } from "@/features/dashboard/shared/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { prepListKeys } from "@/features/dashboard/production/prep-list/hooks/use-prep-list";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
} from "@/lib/utils/cache-helpers";

/**
 * Drains the offline prep-list quick-log queue. Unlike table status, a
 * quick-log is a pure append (a new ProductionBatch row) with no "someone
 * else already moved it" conflict to detect — it's the same idempotent-
 * replay shape as the POS order queue. The entry's own id doubles as
 * ProductionBatch.clientRequestId so a lost response or duplicate flush
 * can't double-credit stock.
 *
 * Like sales, a log the server keeps refusing is parked for a person rather
 * than deleted: it records stock that physically exists.
 */
export function useOfflineProductionQueue(storeId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<OfflineProductionLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const mine = (await listProductionQueue()).filter((e) => e.storeId === storeId);
    setEntries((prev) => (sameQueueEntries(prev, mine) ? prev : mine));
  }, [storeId]);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !storeId) return;
    const mine = (await listProductionQueue()).filter((e) => e.storeId === storeId);
    if (!mine.some((e) => !e.needsAttention)) return;

    syncingRef.current = true;
    setIsSyncing(true);
    let result;
    try {
      result = await replayQueue(mine, {
        send: (entry) =>
          apiClient.post(`/stores/${storeId}/production/prep-list`, {
            productId: entry.productId,
            quantity: entry.quantity,
            clientRequestId: entry.id,
          }),
        remove: (entry) => removeFromProductionQueue(entry.id),
        reject: async (entry, failure) => {
          const next = await recordProductionRejection(entry, failure, MAX_REJECTED_ATTEMPTS);
          return { parked: !!next.needsAttention };
        },
      });
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
    await refreshCount();

    setNeedsSignIn(result.stoppedBy === "auth");
    if (result.parked > 0) {
      toast.error(
        t("pos.offline.productionNeedsAttention").replace("{count}", String(result.parked))
      );
    }
    if (result.synced > 0) {
      toast.success(t("pos.offline.productionSynced").replace("{count}", String(result.synced)));
      queryClient.invalidateQueries({ queryKey: prepListKeys.byStore(storeId) });
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
      await invalidateMaterialRelatedQueries(queryClient, storeId);
      await invalidateProductRelatedQueries(queryClient, storeId);
      await setLastSyncedAt(storeId);
    }
  }, [storeId, queryClient, refreshCount, t]);

  const retryParked = useCallback(async () => {
    await requeueParkedProduction(storeId);
    await refreshCount();
    await syncQueue();
  }, [storeId, refreshCount, syncQueue]);

  const discardEntry = useCallback(
    async (id: string) => {
      await removeFromProductionQueue(id);
      await refreshCount();
    },
    [refreshCount]
  );

  useEffect(() => {
    refreshCount();
    if (navigator.onLine) syncQueue();
  }, [refreshCount, syncQueue]);

  useEffect(() => {
    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncQueue]);

  return {
    entries,
    pendingCount: entries.filter((e) => !e.needsAttention).length,
    attentionCount: entries.filter((e) => e.needsAttention).length,
    needsSignIn,
    isSyncing,
    syncQueue,
    refreshCount,
    retryParked,
    discardEntry,
  };
}
