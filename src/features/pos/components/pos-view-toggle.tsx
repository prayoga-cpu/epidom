"use client";

import { Columns3, LayoutGrid, List, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { POS_VIEW_MODES, usePosViewMode, type PosViewMode } from "../hooks/use-pos-view-mode";

const ICONS: Record<PosViewMode, LucideIcon> = {
  grid: LayoutGrid,
  columns: Columns3,
  list: List,
};

/**
 * Grid / Columns / List switch for the menu. Three icon buttons, each a 40px
 * target, inside a 42px-tall frame so the whole control fits the 44px top bar
 * with its border.
 */
export function PosViewToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const viewMode = usePosViewMode((s) => s.viewMode);
  const setViewMode = usePosViewMode((s) => s.setViewMode);

  return (
    <div
      role="group"
      aria-label={t("cashierCheckout.view.label")}
      className={cn(
        "bg-background flex shrink-0 items-center overflow-hidden rounded-md border",
        className
      )}
    >
      {POS_VIEW_MODES.map((mode) => {
        const Icon = ICONS[mode];
        const label = t(`cashierCheckout.view.${mode}`);
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => setViewMode(mode)}
            className={cn(
              "flex h-10 w-10 touch-manipulation items-center justify-center transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
