"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { isOfflineModeEnabled, setOfflineModeEnabled } from "@/lib/pwa/offline-mode";
import { isOfflinePersistedQueryKey } from "@/lib/pwa/query-persister";

/**
 * Offline Mode eagerly primes the offline data mirror (instead of waiting
 * for the cashier to naturally browse every screen) and requests durable
 * storage. It's mandatory, not opt-in, once the app is running installed
 * (standalone display mode) — someone who installed Epidom to their home
 * screen has already signaled "I want this to work without a connection,"
 * so there's no toggle to turn it back off in that state: `enabled` reports
 * `true` unconditionally while standalone, and `disableOfflineMode` is a
 * no-op then (the UI backs this up by disabling the switch, but the hook
 * itself refuses too, so no other call site can bypass it).
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
    // No opt-out while installed — see the module docstring.
    if (!storeId || isStandalone) return;
    await setOfflineModeEnabled(storeId, false);
    setEnabledState(false);
  }, [storeId, isStandalone]);

  useEffect(() => {
    if (!storeId) return;
    isOfflineModeEnabled(storeId).then(setEnabledState);
  }, [storeId]);

  // Standalone-install detector: unlike before, this no longer checks for a
  // prior explicit opt-out — installed means mandatory, full stop — so it
  // just turns Offline Mode on (idempotent) once per standalone/store change.
  useEffect(() => {
    if (!isStandalone || !storeId) return;
    enableOfflineMode();
    // Intentionally omits enableOfflineMode — only re-run when standalone/store identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone, storeId]);

  return {
    // Forced true while standalone regardless of the persisted/async-loaded
    // value, so the UI never shows "off" even for the one tick before the
    // effect above resolves.
    enabled: isStandalone || enabled,
    isPriming,
    isStandalone,
    enableOfflineMode,
    disableOfflineMode,
  };
}
