"use client";

import { CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";

interface UnpaidFilterToggleProps {
  active: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
}

export function UnpaidFilterToggle({
  active,
  onToggle,
  count,
  className,
}: UnpaidFilterToggleProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
        active
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-input text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <CircleDollarSign className="h-4 w-4" />
      {t("pos.queue.unpaidOnly")}
      {typeof count === "number" && count > 0 && <span>({count})</span>}
    </button>
  );
}
