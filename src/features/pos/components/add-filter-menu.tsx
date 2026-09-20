"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FilterOptionDef {
  key: string;
  label: string;
}

interface AddFilterMenuProps {
  options: FilterOptionDef[];
  onAdd: (key: string) => void;
  className?: string;
  /**
   * "chip" (default) — the dashed, rounded Notion-style chip used in the filter rows
   * (order queue, order history, the phone-width POS row).
   * "bar" — a flat ghost block for the POS Mode top bar only: no border, square
   * corners, as tall as the bar so its hover tint is a block edge to edge.
   */
  variant?: "chip" | "bar";
}

const BASE = "flex cursor-pointer items-center gap-1.5 px-3 text-sm font-medium transition-colors";

const VARIANT_CLASS = {
  chip: "border-input text-muted-foreground hover:text-foreground hover:border-foreground/40 h-9 rounded-md border border-dashed",
  bar: "text-muted-foreground hover:bg-accent hover:text-accent-foreground h-full rounded-none",
} as const;

/** Notion-style "+ Add filter" trigger — lists only filter dimensions not already visible. */
export function AddFilterMenu({ options, onAdd, className, variant = "chip" }: AddFilterMenuProps) {
  const { t } = useI18n();

  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(BASE, VARIANT_CLASS[variant], className)}>
          <Plus className="h-3.5 w-3.5" />
          {t("pos.filters.addFilter")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.key} onClick={() => onAdd(opt.key)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
