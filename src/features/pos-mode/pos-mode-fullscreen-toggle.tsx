"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useFullscreen } from "@/hooks/use-fullscreen";

/**
 * Status-bar button that puts the whole POS in browser fullscreen — no tabs,
 * no address bar, more room for the till on a tablet. Same toggle as the
 * customer display's. Renders nothing where the browser has no fullscreen
 * (iPhone Safari), rather than a button that can't do anything.
 */
export function PosModeFullscreenToggle() {
  const { t } = useI18n();
  const { isFullscreen, supported, toggle } = useFullscreen();
  if (!supported) return null;

  const label = t(
    isFullscreen ? "cashierCheckout.topBar.exitFullscreen" : "cashierCheckout.topBar.fullscreen"
  );
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isFullscreen}
      className="hover:bg-muted text-muted-foreground hover:text-foreground flex size-10 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-md transition-colors"
    >
      {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
    </button>
  );
}
