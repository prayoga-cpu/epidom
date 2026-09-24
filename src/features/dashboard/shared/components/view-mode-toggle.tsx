"use client";

import { Columns3, LayoutGrid, List, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * How a collection lays its items out:
 *  - grid: full cards
 *  - columns: compact cards, more per row
 *  - list: one row per item
 */
export type ViewMode = "grid" | "columns" | "list";

export const VIEW_MODES: readonly ViewMode[] = ["grid", "columns", "list"];

export function isViewMode(value: unknown): value is ViewMode {
  return VIEW_MODES.includes(value as ViewMode);
}

const ICONS: Record<ViewMode, LucideIcon> = {
  grid: LayoutGrid,
  columns: Columns3,
  list: List,
};

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Accessible name of the whole switch, e.g. "Item layout". */
  label: string;
  /** Accessible name and tooltip of each button. */
  labels: Record<ViewMode, string>;
  className?: string;
}

/**
 * Grid / Columns / List switch with the POS menu's look (`PosViewToggle`):
 * three 40px icon buttons in one bordered frame, the active one filled.
 */
export function ViewModeToggle({ value, onChange, label, labels, className }: ViewModeToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "bg-background flex shrink-0 items-center overflow-hidden rounded-md border",
        className
      )}
    >
      {VIEW_MODES.map((mode) => {
        const Icon = ICONS[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={labels[mode]}
            title={labels[mode]}
            onClick={() => onChange(mode)}
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
