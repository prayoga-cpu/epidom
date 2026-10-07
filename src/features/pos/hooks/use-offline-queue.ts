"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listQueue,
  removeFromQueue,
  recordRejection,
  requeueParked,
  OFFLINE_QUEUE_CHANGED_EVENT,
  type OfflineOrder,
} from "@/lib/pwa/offline-queue";
import { apiClient } from "@/lib/api/client";
import { setLastSyncedAt } from "@/lib/pwa/sync-status";
import { getReachabilitySnapshot } from "@/lib/pwa/reachability";
import { replayQueue, sameQueueEntries, type ReplayResult } from "@/lib/pwa/replay-queue";
import { MAX_REJECTED_ATTEMPTS } from "@/lib/pwa/sync-failure";
import { useI18n } from "@/components/lang/i18n-provider";

/** A replayed sale gets longer than a live checkout: nobody is standing at the till. */
const REPLAY_TIMEOUT_MS = 30_000;

/**
 * When to try sending a sale queued while the connection still reads online: a
 * checkout that timed out (wifi up, internet slow or the API degraded) queues
 * it without the browser ever going offline, so the "online" event below never
 * fires for it. Backs off while the sale stays unsent, then keeps trying at the
 * last step until it goes through, the device goes offline (the reconnect
 * flush takes over) or a sign-in is needed.
 */
const QUEUED_WHILE_ONLINE_RETRY_MS = [5_000, 15_000, 60_000] as const;

export function useOfflineQueue(storeId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  // This store's entries only. The queue is shared by every outlet signed in on
  // the device, and counting another outlet's sales here used to read as "this
  // till has unsynced sales" when it had none.
  const [entries, setEntries] = useState<OfflineOrder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  // State can't guard re-entry: two triggers in one tick both read the stale
  // `false`, and two concurrent passes would POST the same entries.
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const mine = (await listQueue()).filter((e) => e.storeId === storeId);
    setEntries((prev) => (sameQueueEntries(prev, mine) ? prev : mine));
  }, [storeId]);

  /** One pass over this store's queue. Null when another pass was running or there was nothing to send. */
  const syncQueue = useCallback(async (): Promise<ReplayResult | null> => {
    if (syncingRef.current || !storeId) return null;
    // Claimed BEFORE the IndexedDB read: two triggers landing within that read
    // both passed the check and replayed the same entries.
    syncingRef.current = true;
    let mine;
    try {
      mine = (await listQueue()).filter((e) => e.storeId === storeId);
    } catch (err) {
      syncingRef.current = false;
      throw err;
    }
    if (!mine.some((e) => !e.needsAttention)) {
      syncingRef.current = false;
      return null;
    }

    setIsSyncing(true);
    let result: ReplayResult;
    try {
      result = await replayQueue(mine, {
        // The queue entry's own id doubles as the idempotency key. Without it a
        // lost response — or a second tab flushing the same IndexedDB queue —
        // creates a duplicate order AND double-deducts the stock behind it. The
        // server returns the existing order instead of creating another.
        // Sent without `liveCheckout`, so the server treats it as a replay (see
        // isOfflineReplay). clientCreatedAt dates the sale; entries queued before
        // it was stamped at enqueue time fall back to when they were queued.
        send: (entry) =>
          apiClient.post(
            `/stores/${storeId}/pos/orders`,
            {
              ...entry.order,
              clientCreatedAt: entry.order.clientCreatedAt ?? entry.queuedAt,
              clientRequestId: entry.id,
            },
            { timeoutMs: REPLAY_TIMEOUT_MS }
          ),
        remove: (entry) => removeFromQueue(entry.id),
        reject: async (entry, failure) => {
          const next = await recordRejection(entry, failure, MAX_REJECTED_ATTEMPTS);
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
      toast.error(t("pos.offline.needsAttention").replace("{count}", String(result.parked)));
    }
    if (result.synced > 0) {
      toast.success(t("pos.offline.synced").replace("{count}", String(result.synced)));
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      // A push flush counts as a sync even if the pull side didn't run this
      // pass — a partial flush (some entries still retrying) still means
      // real data reached the server, so "last synced" should reflect it.
      await setLastSyncedAt(storeId);
    }
    return result;
  }, [storeId, queryClient, refreshCount, t]);

  /** Puts sales the server refused back in line and tries them again now. */
  const retryParked = useCallback(async () => {
    await requeueParked(storeId);
    await refreshCount();
    await syncQueue();
  }, [storeId, refreshCount, syncQueue]);

  /** Removes one sale from this device for good. Only ever a person's choice. */
  const discardEntry = useCallback(
    async (id: string) => {
      await removeFromQueue(id);
      await refreshCount();
    },
    [refreshCount]
  );

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

  // A sale just queued by the checkout dialog. Queued while the connection
  // still reads online — a checkout that timed out — there is no offline ->
  // online recovery for useOfflineSync to react to, so nothing would send it
  // until the next reload or outage, and a shift closed meanwhile would leave it
  // off its drawer. Try again shortly: the entry carries the same
  // clientRequestId, so a sale whose first attempt did land is returned, not
  // created twice.
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;
    const schedule = () => {
      clearTimeout(retry);
      const steps = QUEUED_WHILE_ONLINE_RETRY_MS;
      retry = setTimeout(
        async () => {
          // Checked again when it fires, not only when it was set: the checkout's
          // network failure starts a reachability probe that may since have found
          // the device offline — then the reconnect flush (useOfflineSync) owns it.
          if (disposed || !getReachabilitySnapshot().isOnline) return;
          const result = await syncQueue();
          if (disposed || result?.stoppedBy === "auth") return;
          const stillPending = (await listQueue()).some(
            (e) => e.storeId === storeId && !e.needsAttention
          );
          if (stillPending && !disposed) {
            attempt += 1;
            schedule();
          }
        },
        steps[Math.min(attempt, steps.length - 1)]
      );
    };
    const handleChanged = () => {
      void refreshCount();
      if (getReachabilitySnapshot().isOnline) {
        attempt = 0;
        schedule();
      }
    };
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleChanged);
    return () => {
      disposed = true;
      clearTimeout(retry);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleChanged);
    };
  }, [refreshCount, syncQueue, storeId]);

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
