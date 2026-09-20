"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useAppZoom } from "@/lib/hooks/use-app-zoom";
import { cn } from "@/lib/utils";

interface ZoomControlProps {
  /**
   * Where the "Zoom" label sits. `stacked` (default) puts it above the stepper —
   * the account dropdown. `inline` puts an icon and the label on the left with
   * the stepper on the right — a row in POS Mode's device-preferences card.
   * `none` renders the stepper alone, for a caller that draws its own label (the
   * Back Office mobile drawer, whose other preferences are all labelled blocks).
   */
  label?: "stacked" | "inline" | "none";
}

/**
 * Zoom stepper — an in-app stand-in for the browser's Ctrl +/−, which a locked
 * viewport (mobile) or an installed PWA (no browser chrome) leaves the user with
 * no way to reach. Mounted in every shell so it is reachable wherever the app
 * is used: the Back Office account dropdown (desktop and mobile), the Back
 * Office mobile drawer, and POS Mode's More menu. See `src/lib/app-zoom.ts` for
 * how the preference is applied and stored.
 *
 * Plain buttons rather than `DropdownMenuItem`s on purpose: an item closes
 * the menu on select, and zooming is a step-and-look control — you want to
 * press − twice, see the result, and press it again without the menu
 * disappearing underneath. Clicks on non-item content leave the menu open.
 */
export function ZoomControl({ label = "stacked" }: ZoomControlProps) {
  const { t } = useI18n();
  const {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn,
    canZoomOut,
    isDefaultZoom,
    limitedByScreen,
  } = useAppZoom();

  // A narrow screen can't zoom in without the layout dropping below the width it
  // was built for (see `maxZoomForWidth`). Say so under the stepper, or the
  // disabled "+" reads as a control that doesn't work on a phone.
  const hint = limitedByScreen ? (
    <p className="text-muted-foreground px-1 pt-1 text-[11px] leading-snug">{t("nav.zoomLimit")}</p>
  ) : null;

  const stepper = (
    <div
      className={cn(
        "bg-muted/50 flex items-center gap-1 rounded-md border p-0.5",
        label === "inline" && "shrink-0"
      )}
    >
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
          nothing to reset (`disabled:opacity-100`). Fixed width in the inline
          layout, where nothing around it is free to stretch. */}
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-10 min-w-0 touch-manipulation rounded-sm text-sm font-semibold tabular-nums disabled:opacity-100",
          label === "inline" ? "w-14" : "flex-1"
        )}
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
  );

  if (label === "inline") {
    return (
      <div>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ZoomIn className="size-5 shrink-0" aria-hidden />
            <span className="truncate text-sm font-medium">{t("nav.zoom")}</span>
          </div>
          {stepper}
        </div>
        {hint}
      </div>
    );
  }

  if (label === "none") {
    return (
      <div>
        {stepper}
        {hint}
      </div>
    );
  }

  return (
    <div className="px-1 py-1">
      <p className="text-muted-foreground px-1 pb-1 text-[11px] font-medium">{t("nav.zoom")}</p>
      {stepper}
      {hint}
    </div>
  );
}
