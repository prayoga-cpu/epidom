"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useCurrentStore } from "./hooks/use-current-store";
import { useOfflineSync } from "@/features/pos/hooks/use-offline-sync";
import { useOfflineMode } from "@/features/pos/hooks/use-offline-mode";

interface OfflineSyncContextValue {
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  pendingCount: number;
  /**
   * Confirmed by a real round-trip to our own origin, not by
   * `navigator.onLine` — so it stays `false` behind a café captive portal and
   * on wifi that has stopped forwarding packets, which is exactly where
   * `navigator.onLine` claims everything is fine. Any UI that tells a cashier
   * whether they are connected should read this.
   */
  isOnline: boolean;
  syncNow: () => Promise<void>;
  offlineModeEnabled: boolean;
  isPriming: boolean;
  isStandalone: boolean;
  enableOfflineMode: () => Promise<void>;
  disableOfflineMode: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

/**
 * Mounted once at the PageShell root. The PWA install trigger renders in
 * both Topbar and Sidebar (and Sidebar renders again inside the mobile
 * drawer) — each calling useOfflineSync/useOfflineMode independently would
 * mean multiple concurrent flushes of the same offline order queue on
 * reconnect, and multiple concurrent "prime offline data" passes when the
 * standalone-install detector fires. This context gives every consumer the
 * same single instance instead.
 */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { storeId } = useCurrentStore();
  const sync = useOfflineSync(storeId ?? "");
  const mode = useOfflineMode(storeId ?? "");

  const value: OfflineSyncContextValue = {
    lastSyncedAt: sync.lastSyncedAt,
    isSyncing: sync.isSyncing,
    pendingCount: sync.pendingCount,
    isOnline: sync.isOnline,
    syncNow: sync.syncNow,
    offlineModeEnabled: mode.enabled,
    isPriming: mode.isPriming,
    isStandalone: mode.isStandalone,
    enableOfflineMode: mode.enableOfflineMode,
    disableOfflineMode: mode.disableOfflineMode,
  };

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSyncContext(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSyncContext must be used within OfflineSyncProvider");
  }
  return ctx;
}
