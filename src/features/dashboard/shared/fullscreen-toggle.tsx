"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useFullscreen } from "@/hooks/use-fullscreen";

/**
 * The sidebar's fullscreen button: puts the whole page in browser fullscreen
 * (no tabs or address bar). Same toggle as the POS status bar's, dressed like
 * the other quick controls (cream icon on the navy sidebar). Renders nothing
 * where the browser has no fullscreen (iPhone Safari).
 */
export function FullscreenToggle() {
  const { t } = useI18n();
  const { isFullscreen, supported, toggle } = useFullscreen();
  if (!supported) return null;

  const label = t(
    isFullscreen ? "cashierCheckout.topBar.exitFullscreen" : "cashierCheckout.topBar.fullscreen"
  );
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 hover:bg-white/10"
      style={{ color: "var(--epi-cream-50)" }}
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </Button>
  );
}
