"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_ZOOM,
  ZOOM_LEVELS,
  applyZoom,
  canStepZoom,
  readEffectiveZoom,
  readMaxZoom,
  setStoredZoom,
  stepZoom,
  subscribeZoom,
} from "@/lib/app-zoom";

const LADDER_MAX = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/**
 * Reads and writes the device's UI zoom (see `src/lib/app-zoom.ts`).
 *
 * `useSyncExternalStore` rather than `useState` for two reasons: localStorage
 * is the source of truth shared by every mounted control (the topbar renders
 * the account dropdown twice — desktop and mobile — and both must agree), and
 * its server snapshot gives React the hydration-safe 100% for the first
 * render, so a saved 90% doesn't trip a hydration mismatch on the way in.
 *
 * `zoom` is the zoom actually *in effect* — the saved preference held to what
 * this screen can take — and `maxZoom` is that ceiling. On a phone the two
 * differ from the ladder's own top: `canZoomIn` is false at 100% there, and
 * `limitedByScreen` says so, so a disabled "+" can be explained rather than
 * read as a broken control.
 */
export function useAppZoom() {
  const zoom = useSyncExternalStore(
    subscribeZoom,
    readEffectiveZoom,
    () => DEFAULT_ZOOM // Server render: nothing to read, and no flash — the
    // boot script in the root layout has already zoomed the document.
  );
  const maxZoom = useSyncExternalStore(subscribeZoom, readMaxZoom, () => LADDER_MAX);

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
  const zoomIn = useCallback(
    () => setStoredZoom(stepZoom(readEffectiveZoom(), 1, readMaxZoom())),
    []
  );
  const zoomOut = useCallback(() => setStoredZoom(stepZoom(readEffectiveZoom(), -1)), []);
  const resetZoom = useCallback(() => setStoredZoom(DEFAULT_ZOOM), []);

  return {
    zoom,
    maxZoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: canStepZoom(zoom, 1, maxZoom),
    canZoomOut: canStepZoom(zoom, -1),
    isDefaultZoom: zoom === DEFAULT_ZOOM,
    /** At this screen's ceiling, and that ceiling is below the ladder's top. */
    limitedByScreen: maxZoom < LADDER_MAX && zoom >= maxZoom,
  };
}
