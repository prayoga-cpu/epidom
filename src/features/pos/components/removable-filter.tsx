"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";

interface RemovableFilterProps {
  onRemove: () => void;
  children: React.ReactNode;
  className?: string;
}

/** Wraps an active filter control with a small remove (×) button, Notion-chip style. */
export function RemovableFilter({ onRemove, children, className }: RemovableFilterProps) {
  const { t } = useI18n();

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {children}
      <button
        type="button"
        onClick={onRemove}
        title={t("pos.filters.removeFilter")}
        className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-6 shrink-0 items-center justify-center rounded-md"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
