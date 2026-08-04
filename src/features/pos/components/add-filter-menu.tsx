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
}

/** Notion-style "+ Add filter" trigger — lists only filter dimensions not already visible. */
export function AddFilterMenu({ options, onAdd, className }: AddFilterMenuProps) {
  const { t } = useI18n();

  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-input text-muted-foreground hover:text-foreground hover:border-foreground/40 flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm font-medium transition-colors",
            className
          )}
        >
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
