"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  subscribeToReachability,
  getReachabilitySnapshot,
  getServerReachabilitySnapshot,
  checkReachabilityNow,
} from "@/lib/pwa/reachability";

export interface NetworkStatus {
  /**
   * Confirmed by an actual round-trip to our own origin, not by
   * `navigator.onLine` — see `src/lib/pwa/reachability.ts` for why that
   * distinction matters on in-store wifi and behind captive portals.
   */
  isOnline: boolean;
  /** When the last probe completed. `null` until the first one lands. */
  lastCheckedAt: Date | null;
}

/**
 * Live connectivity status, backed by the shared ~1s reachability probe.
 *
 * Cost note for whoever reaches for this next: `lastCheckedAt` changes on
 * every probe, so a component calling `useNetworkStatus` re-renders roughly
 * once a second while the app is visible. That is fine for a small status
 * indicator (a banner, a "last checked" line) and wrong for anything sitting
 * high in the tree. If all you need is the on/off state, use
 * `useOnlineStatus` instead — it only re-renders when connectivity actually
 * flips. If you need to *react* to a reconnect, use `useOnlineRecovery`,
 * which re-renders nothing at all.
 */
export function useNetworkStatus(): NetworkStatus {
  const snapshot = useSyncExternalStore(
    subscribeToReachability,
    getReachabilitySnapshot,
    getServerReachabilitySnapshot
  );

  return { isOnline: snapshot.isOnline, lastCheckedAt: snapshot.lastCheckedAt };
}

/**
 * Just the boolean. `useSyncExternalStore` compares the returned primitive,
 * so a consumer re-renders on an online/offline flip and on nothing else,
 * even though the underlying probe is running once a second.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToReachability,
    () => getReachabilitySnapshot().isOnline,
    () => getServerReachabilitySnapshot().isOnline
  );
}

/**
 * Fires `onRecovered` on each offline -> online transition, and never on the
 * probes in between. This is the hook for expensive reconnect work (cache
 * refetches, queue flushes): it holds no React state, so subscribing costs
 * the caller zero renders regardless of how fast the probe loop runs.
 *
 * The callback is read through a ref so a caller passing an inline closure
 * doesn't tear down and re-subscribe — which would reset the transition
 * baseline and, worse, could re-fire on the next probe.
 */
export function useOnlineRecovery(onRecovered: () => void): void {
  const callbackRef = useRef(onRecovered);

  useEffect(() => {
    callbackRef.current = onRecovered;
  }, [onRecovered]);

  useEffect(() => {
    let wasOnline = getReachabilitySnapshot().isOnline;
    return subscribeToReachability((snapshot) => {
      const recovered = !wasOnline && snapshot.isOnline;
      wasOnline = snapshot.isOnline;
      if (recovered) callbackRef.current();
    });
  }, []);
}

/**
 * Escape hatch for "check right now" moments that shouldn't wait for the
 * next scheduled probe — e.g. immediately before a write the user just
 * confirmed. Shares the in-flight request with the loop, so calling it in a
 * burst still costs one round-trip.
 */
export { checkReachabilityNow };
