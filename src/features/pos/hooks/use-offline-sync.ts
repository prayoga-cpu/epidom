"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOfflineQueue } from "./use-offline-queue";
import { getLastSyncedAt, setLastSyncedAt } from "@/lib/pwa/sync-status";
import { isOfflinePersistedQueryKey } from "@/lib/pwa/query-persister";
import { useOnlineStatus, useOnlineRecovery } from "@/hooks/use-network-status";

/**
 * Single source of truth for offline sync state, meant to be mounted once
 * (see OfflineSyncProvider) rather than called from every consumer — the
 * install dialog and the POS offline banner can both render at once, and a
 * second independent `useOfflineQueue` instance would flush (and toast) the
 * same write queue twice on reconnect.
 *
 * ── A 1-second probe is not a 1-second sync ──────────────────────────────
 * Connectivity is *checked* once a second **while offline** — the state where
 * someone is actually waiting for the reconnect, and where the check is free
 * because the request fails on-device without reaching the network. While
 * online it heartbeats slowly instead (see `src/lib/pwa/reachability.ts` for
 * why the cadence is asymmetric, and what it costs on Vercel's Hobby plan if
 * it isn't). A sync is *performed* only when that check reports an offline ->
 * online transition, or when the user explicitly asks
 * via `syncNow`. Those are two very different budgets and collapsing them
 * would be a serious regression: a sync pass refetches every offline-mirrored
 * query (menu, materials, staff, schedules, the live order queue) and drains
 * the queued-order write queue. Running that once a second would keep a
 * cashier's tablet permanently busy, re-render the POS grid mid-tap, and put
 * a store's worth of devices into a constant refetch storm on the exact
 * flaky wifi this feature exists to tolerate. The fast cadence buys a fast
 * *detection* of reconnect — nothing more.
 *
 * The probe replaced a plain `window` `online` listener because that event
 * tracks the network interface, not the network: it never fires behind a
 * captive portal, never fires when a silently-degraded link recovers, and
 * `navigator.onLine` reports `true` in both cases. Syncs were simply being
 * missed, leaving `lastSyncedAt` stale with no path back short of the user
 * noticing and tapping "sync now".
 */
export function useOfflineSync(storeId: string) {
  const queryClient = useQueryClient();
  const offlineQueue = useOfflineQueue(storeId);
  const [lastSyncedAt, setLastSyncedAtState] = useState<Date | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  // setIsPulling (state) doesn't read back synchronously within the same
  // tick — two reconnect signals landing back-to-back (e.g. a flaky
  // connection flapping, or a probe-detected recovery racing a manual
  // "sync now" tap) would both see the pre-update `isPulling` value and both
  // slip past the guard. A ref closes that race.
  const isPullingRef = useRef(false);
  // Same race, push side. `useOfflineQueue.syncQueue` guards itself with an
  // `isSyncing` *state* value, which has the identical read-back problem —
  // and the consequence there is worse than a wasted refetch: two concurrent
  // flushes both `listQueue()` the same pending entries and POST each one
  // twice, so the store ends up with duplicate orders. This ref keeps every
  // flush routed through this hook serialized.
  const isFlushingRef = useRef(false);

  // Reachability-confirmed, so this is safe to surface in UI as the real
  // connectivity state. Only re-renders when it actually flips, never on the
  // intervening probes.
  const isOnline = useOnlineStatus();

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
    if (!storeId || isPullingRef.current) return;
    // `navigator.onLine` is untrustworthy when it says `true` but reliable
    // when it says `false` — the browser knows there is no interface at all.
    // Worth keeping purely as a cheap way to skip a doomed refetch storm.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
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

  // Push: drain the queued-order write queue. `useOfflineQueue` has its own
  // `online`-event listener, but that is the same unreliable event described
  // above, so the push side is driven from here too rather than assumed to
  // have happened. `syncQueue` is a no-op when the queue is empty, so this
  // stays cheap on the overwhelmingly common empty-queue reconnect.
  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;
    try {
      await offlineQueue.syncQueue();
    } finally {
      isFlushingRef.current = false;
    }
  }, [offlineQueue]);

  // Reconnect runs both directions: flush queued orders, refresh the
  // read-only mirror, then re-read the stamped timestamp (either side may
  // have moved it).
  const runFullSync = useCallback(async () => {
    if (!storeId) return;
    await Promise.all([flushQueue(), pullSync()]);
    await refreshLastSynced();
  }, [storeId, flushQueue, pullSync, refreshLastSynced]);

  // The only automatic trigger. Fires on the offline -> online transition
  // reported by the probe, not on every probe — see the header comment.
  useOnlineRecovery(() => {
    void runFullSync();
  });

  return {
    lastSyncedAt,
    isSyncing: isPulling || offlineQueue.isSyncing,
    pendingCount: offlineQueue.pendingCount,
    syncNow: runFullSync,
    isOnline,
  };
}

export type OfflineSyncState = ReturnType<typeof useOfflineSync>;
