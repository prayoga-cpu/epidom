"use client";

import { useEffect } from "react";
import { applyZoom, readStoredZoom } from "@/lib/app-zoom";

/**
 * Keeps the document's zoom in step with the screen, from the root layout.
 *
 * The saved preference is applied before first paint by the boot script, but how
 * much of it a screen can take depends on its width (`maxZoomForWidth`), and that
 * changes without a reload: a tablet rotates, a phone folds open, a desktop
 * window is dragged narrow. Something that is always mounted has to re-apply it
 * — the zoom control isn't, since its menu isn't rendered until it is opened —
 * or a 150% chosen in landscape stays 150% after rotating to portrait, where the
 * layout no longer fits it.
 *
 * `applyZoom` is idempotent and cheap (a few identical style writes), so it runs
 * on every event rather than tracking the last width.
 */
export function AppZoomSync() {
  useEffect(() => {
    const sync = () => applyZoom(readStoredZoom());
    sync();
    window.addEventListener("resize", sync);
    // Some mobile browsers fire this before `resize` has settled on the new width.
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return null;
}
