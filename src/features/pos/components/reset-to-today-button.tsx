"use client";

import { RotateCcw } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

interface ResetToTodayButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * "Reset to today" — sends a date filter that has been moved off its default
 * (today's orders) back to it. Rendered only while the date differs from today;
 * an always-present button would have nothing to do most of the time.
 */
export function ResetToTodayButton({ onClick, className }: ResetToTodayButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:text-foreground flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors",
        className
      )}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {t("pos.filters.resetToToday")}
    </button>
  );
}
