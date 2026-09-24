"use client";

import type { ComponentType } from "react";
import { Wine } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { PosMenuDepartment } from "../lib/menu-department";

/**
 * A burger in lucide's style (24px grid, 2px round strokes, currentColor), for
 * the Food tab: lucide-react 0.454 has no burger icon. Top bun, filling, bottom bun.
 */
function BurgerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 10a8 7 0 0 1 16 0Z" />
      <path d="M3 13.5h18" />
      <path d="M4 17h16v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" />
    </svg>
  );
}

interface PosDepartmentBarProps {
  selectedDepartment: PosMenuDepartment | null;
  onSelectDepartment: (department: PosMenuDepartment | null) => void;
  // Store-owner-authored label for the optional second product line (e.g.
  // "Hair Salon") — its tab only renders when this is provided (i.e. the store
  // has the feature enabled). See Store.customProductsEnabled/customProductsLabel.
  customDepartmentLabel?: string | null;
  /**
   * "bar" — flat, full-height blocks for the POS Mode top bar, like the search
   * field beside them. "inline" (default) — a bordered segmented control of 40px
   * buttons, like the view toggle, for the toolbar row the till draws below md.
   * On a phone (below sm) its Food and Drink tabs are icon-only, so the whole
   * control fits on the search box's row.
   */
  variant?: "bar" | "inline";
}

/**
 * All / Food (burger) / Drink (wine glass) (/ custom line) tabs — the first step
 * of finding an item, always on screen. Food is the Kitchen department and Drink the Bar one (see
 * menu-department.ts), so an item lands under a tab by the Department set on it
 * in the Back Office. Picking a tab also takes the menu back to its category
 * cards (PosShell).
 */
export function PosDepartmentBar({
  selectedDepartment,
  onSelectDepartment,
  customDepartmentLabel,
  variant = "inline",
}: PosDepartmentBarProps) {
  const { t } = useI18n();

  const tabs: {
    value: PosMenuDepartment | null;
    label: string;
    icon?: ComponentType<{ className?: string }>;
  }[] = [
    { value: null, label: t("pos.menu.all") },
    { value: "KITCHEN", label: t("pos.menu.food"), icon: BurgerIcon },
    { value: "BAR", label: t("pos.menu.drink"), icon: Wine },
    ...(customDepartmentLabel ? [{ value: "CUSTOM" as const, label: customDepartmentLabel }] : []),
  ];

  return (
    <div
      role="group"
      aria-label={t("pos.menu.departments")}
      className={cn(
        "flex shrink-0",
        variant === "bar" ? "h-full" : "bg-background overflow-hidden rounded-md border"
      )}
    >
      {tabs.map((tab) => {
        const active = selectedDepartment === tab.value;
        // Inline on a phone, a tab with an icon shows only the icon: its label stays
        // in the button for screen readers (sr-only) and as a long-press/hover title.
        const iconOnlyOnPhone = variant === "inline" && !!tab.icon;
        return (
          <button
            key={tab.value ?? "ALL"}
            type="button"
            aria-pressed={active}
            title={iconOnlyOnPhone ? tab.label : undefined}
            onClick={() => onSelectDepartment(tab.value)}
            className={cn(
              "flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors",
              // The bar's full 44px height; 40px inside the inline frame's border.
              // Inline tabs are narrower on a phone (an icon, or "All") — 40px wide
              // at least, the touch floor — and regain the roomy width from sm up.
              variant === "bar" ? "h-full min-w-16 px-4" : "h-10 min-w-10 px-3 sm:min-w-16 sm:px-4",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {tab.icon && <tab.icon className="size-4 shrink-0" />}
            <span className={cn(iconOnlyOnPhone && "sr-only sm:not-sr-only")}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
