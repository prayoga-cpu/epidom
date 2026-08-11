"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_ZOOM,
  applyZoom,
  canStepZoom,
  readStoredZoom,
  setStoredZoom,
  stepZoom,
  subscribeZoom,
} from "@/lib/app-zoom";

/**
 * Reads and writes the device's UI zoom (see `src/lib/app-zoom.ts`).
 *
 * `useSyncExternalStore` rather than `useState` for two reasons: localStorage
 * is the source of truth shared by every mounted control (the topbar renders
 * the account dropdown twice — desktop and mobile — and both must agree), and
 * its server snapshot gives React the hydration-safe 100% for the first
 * render, so a saved 90% doesn't trip a hydration mismatch on the way in.
 */
export function useAppZoom() {
  const zoom = useSyncExternalStore(
    subscribeZoom,
    readStoredZoom,
    () => DEFAULT_ZOOM // Server render: nothing to read, and no flash — the
    // boot script in the root layout has already zoomed the document.
  );

  // Safety net for the case the boot script didn't run (an inline script
  // blocked by a strict CSP, an ad blocker rewriting the head). Idempotent,
  // and no-ops entirely at the default.
  useEffect(() => {
    applyZoom(zoom);
  }, [zoom]);

  const setZoom = useCallback((value: number) => {
    setStoredZoom(value);
  }, []);

  // Stepping reads storage rather than closing over `zoom`, so a click that
  // lands before this instance has re-rendered (or one fired from the other
  // dropdown instance) still steps from the current value, not a stale one.
  const zoomIn = useCallback(() => setStoredZoom(stepZoom(readStoredZoom(), 1)), []);
  const zoomOut = useCallback(() => setStoredZoom(stepZoom(readStoredZoom(), -1)), []);
  const resetZoom = useCallback(() => setStoredZoom(DEFAULT_ZOOM), []);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: canStepZoom(zoom, 1),
    canZoomOut: canStepZoom(zoom, -1),
    isDefaultZoom: zoom === DEFAULT_ZOOM,
  };
}
