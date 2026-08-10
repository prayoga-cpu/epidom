"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOfflineQueue } from "./use-offline-queue";
import { getLastSyncedAt, setLastSyncedAt } from "@/lib/pwa/sync-status";
import { isOfflinePersistedQueryKey } from "@/lib/pwa/query-persister";

/**
 * Single source of truth for offline sync state, meant to be mounted once
 * (see OfflineSyncProvider) rather than called from every consumer — the
 * install dialog and the POS offline banner can both render at once, and a
 * second independent `useOfflineQueue` instance would flush (and toast) the
 * same write queue twice on reconnect.
 */
export function useOfflineSync(storeId: string) {
  const queryClient = useQueryClient();
  const offlineQueue = useOfflineQueue(storeId);
  const [lastSyncedAt, setLastSyncedAtState] = useState<Date | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  // setIsPulling (state) doesn't read back synchronously within the same
  // tick — two "online" events dispatched back-to-back (e.g. a flaky
  // connection flapping) would both see the pre-update `isPulling` value and
  // both slip past the guard. A ref closes that race.
  const isPullingRef = useRef(false);

  const refreshLastSynced = useCallback(async () => {
    if (!storeId) return;
    setLastSyncedAtState(await getLastSyncedAt(storeId));
  }, [storeId]);

  useEffect(() => {
    refreshLastSynced();
  }, [refreshLastSynced]);

  // Pull: re-fetch the offline-persisted domains (menu, materials, staff,
  // schedules, KDS/order queue) so a stale mirror refreshes as soon as
  // connectivity is back, not just whenever each screen's own poll fires.
  const pullSync = useCallback(async () => {
    if (!storeId || !navigator.onLine || isPullingRef.current) return;
    isPullingRef.current = true;
    setIsPulling(true);
    try {
      await queryClient.refetchQueries({
        predicate: (query) => isOfflinePersistedQueryKey(query.queryKey),
        type: "active",
      });
      await setLastSyncedAt(storeId);
      await refreshLastSynced();
    } finally {
      isPullingRef.current = false;
      setIsPulling(false);
    }
  }, [queryClient, storeId, refreshLastSynced]);

  // Reconnect triggers both directions: flush queued orders, then refresh
  // the read-only mirror. useOfflineQueue already flushes on its own online
  // listener; this only needs to cover the pull side.
  useEffect(() => {
    if (!storeId) return;
    const handleOnline = () => pullSync();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [storeId, pullSync]);

  const syncNow = useCallback(async () => {
    await Promise.all([offlineQueue.syncQueue(), pullSync()]);
    await refreshLastSynced();
  }, [offlineQueue, pullSync, refreshLastSynced]);

  return {
    lastSyncedAt,
    isSyncing: isPulling || offlineQueue.isSyncing,
    pendingCount: offlineQueue.pendingCount,
    syncNow,
  };
}

export type OfflineSyncState = ReturnType<typeof useOfflineSync>;
