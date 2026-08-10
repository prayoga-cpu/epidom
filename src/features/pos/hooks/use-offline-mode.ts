"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  isOfflineModeEnabled,
  setOfflineModeEnabled,
  getOfflineModeState,
} from "@/lib/pwa/offline-mode";
import { isOfflinePersistedQueryKey } from "@/lib/pwa/query-persister";

/**
 * Offline Mode = an explicit opt-in that eagerly primes the offline data
 * mirror (instead of waiting for the cashier to naturally browse every
 * screen) and requests durable storage. Detects the app running installed
 * (standalone display mode) and auto-enables it the first time — someone
 * who installed Epidom to their home screen has already signaled "I want
 * this to work without a connection," so it shouldn't also require finding
 * a separate switch.
 */
export function useOfflineMode(storeId: string) {
  const { isStandalone } = usePwaInstall();
  const queryClient = useQueryClient();
  const [enabled, setEnabledState] = useState(false);
  const [isPriming, setIsPriming] = useState(false);

  const primeOfflineData = useCallback(async () => {
    if (!storeId) return;
    setIsPriming(true);
    try {
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        // Best-effort — reduces (does not guarantee) storage eviction risk.
        // No-op on browsers without the API (notably iOS Safari).
        await navigator.storage.persist().catch(() => {});
      }
      // "all" (not "active"): priming means getting everything ready for
      // offline, including domains cached earlier this session that aren't
      // the currently-open screen — e.g. enabling this from the topbar while
      // sitting on the Finance page should still refresh a materials query
      // fetched earlier and since gone inactive. This still can't create a
      // query that has never been fetched at all this session (e.g. the
      // cashier has never opened POS since launch) — that first fetch still
      // happens the normal way, the first time that screen mounts.
      await queryClient.refetchQueries({
        predicate: (query) => isOfflinePersistedQueryKey(query.queryKey),
        type: "all",
      });
    } finally {
      setIsPriming(false);
    }
  }, [storeId, queryClient]);

  const enableOfflineMode = useCallback(async () => {
    if (!storeId) return;
    await setOfflineModeEnabled(storeId, true);
    setEnabledState(true);
    await primeOfflineData();
  }, [storeId, primeOfflineData]);

  const disableOfflineMode = useCallback(async () => {
    if (!storeId) return;
    await setOfflineModeEnabled(storeId, false);
    setEnabledState(false);
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    isOfflineModeEnabled(storeId).then(setEnabledState);
  }, [storeId]);

  // Standalone-install detector: fires once ever per store, the first time
  // the app is confirmed running installed. Checks the raw undecided state
  // (not isOfflineModeEnabled's false-default) so a user who has explicitly
  // turned Offline Mode off never has it silently flipped back on just by
  // reopening the installed app.
  useEffect(() => {
    if (!isStandalone || !storeId) return;
    let cancelled = false;
    getOfflineModeState(storeId).then((state) => {
      if (state === null && !cancelled) enableOfflineMode();
    });
    return () => {
      cancelled = true;
    };
    // Intentionally omits enableOfflineMode — only re-run when standalone/store identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone, storeId]);

  return { enabled, isPriming, isStandalone, enableOfflineMode, disableOfflineMode };
}
