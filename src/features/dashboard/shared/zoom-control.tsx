"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useAppZoom } from "@/lib/hooks/use-app-zoom";

/**
 * Zoom stepper for the account dropdown — an in-app stand-in for the
 * browser's Ctrl +/−, which a locked viewport (mobile) or an installed PWA
 * (no browser chrome) leaves the user with no way to reach. See
 * `src/lib/app-zoom.ts` for how the preference is applied and stored.
 *
 * Plain buttons rather than `DropdownMenuItem`s on purpose: an item closes
 * the menu on select, and zooming is a step-and-look control — you want to
 * press − twice, see the result, and press it again without the menu
 * disappearing underneath. Clicks on non-item content leave the menu open.
 */
export function ZoomControl() {
  const { t } = useI18n();
  const { zoom, zoomIn, zoomOut, resetZoom, canZoomIn, canZoomOut, isDefaultZoom } = useAppZoom();

  return (
    <div className="px-1 py-1">
      <p className="text-muted-foreground px-1 pb-1 text-[11px] font-medium">{t("nav.zoom")}</p>
      <div className="bg-muted/50 flex items-center gap-1 rounded-md border p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0 touch-manipulation rounded-sm"
          disabled={!canZoomOut}
          onClick={zoomOut}
        >
          <ZoomOut className="h-4 w-4" />
          <span className="sr-only">{t("nav.zoomOut")}</span>
        </Button>
        {/* The readout doubles as the way back to 100% — keeping reset here
            rather than on its own row keeps every target at 40px. It is the
            level indicator first, so it stays fully legible when there is
            nothing to reset (`disabled:opacity-100`). */}
        <Button
          type="button"
          variant="ghost"
          className="h-10 min-w-0 flex-1 touch-manipulation rounded-sm text-sm font-semibold tabular-nums disabled:opacity-100"
          disabled={isDefaultZoom}
          onClick={resetZoom}
          title={isDefaultZoom ? undefined : t("nav.zoomReset")}
        >
          {zoom}%{!isDefaultZoom && <span className="sr-only">{t("nav.zoomReset")}</span>}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0 touch-manipulation rounded-sm"
          disabled={!canZoomIn}
          onClick={zoomIn}
        >
          <ZoomIn className="h-4 w-4" />
          <span className="sr-only">{t("nav.zoomIn")}</span>
        </Button>
      </div>
    </div>
  );
}
