"use client";

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listProductionQueue,
  removeFromProductionQueue,
  incrementProductionQueueAttempts,
  productionQueueSize,
} from "@/lib/pwa/offline-production-queue";
import { apiClient } from "@/lib/api/client";
import { setLastSyncedAt } from "@/lib/pwa/sync-status";
import { useI18n } from "@/components/lang/i18n-provider";
import { alertKeys } from "@/features/dashboard/shared/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { prepListKeys } from "@/features/dashboard/production/prep-list/hooks/use-prep-list";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
} from "@/lib/utils/cache-helpers";

const MAX_ATTEMPTS = 5;

/**
 * Drains the offline prep-list quick-log queue. Unlike table status, a
 * quick-log is a pure append (a new ProductionBatch row) with no "someone
 * else already moved it" conflict to detect — it's the same idempotent-
 * replay shape as the POS order queue. The entry's own id doubles as
 * ProductionBatch.clientRequestId so a lost response or duplicate flush
 * can't double-credit stock.
 */
export function useOfflineProductionQueue(storeId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await productionQueueSize());
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncing) return;
    const queue = await listProductionQueue();
    const mine = queue.filter((e) => e.storeId === storeId);
    if (mine.length === 0) return;

    setIsSyncing(true);
    let synced = 0;

    for (const entry of mine) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        await removeFromProductionQueue(entry.id);
        continue;
      }

      try {
        await apiClient.post(`/stores/${storeId}/production/prep-list`, {
          productId: entry.productId,
          quantity: entry.quantity,
          clientRequestId: entry.id,
        });
        await removeFromProductionQueue(entry.id);
        synced++;
      } catch {
        await incrementProductionQueueAttempts(entry);
      }
    }

    setIsSyncing(false);
    await refreshCount();

    if (synced > 0) {
      toast.success(t("pos.offline.productionSynced").replace("{count}", String(synced)));
      queryClient.invalidateQueries({ queryKey: prepListKeys.byStore(storeId) });
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
      await invalidateMaterialRelatedQueries(queryClient, storeId);
      await invalidateProductRelatedQueries(queryClient, storeId);
      await setLastSyncedAt(storeId);
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
