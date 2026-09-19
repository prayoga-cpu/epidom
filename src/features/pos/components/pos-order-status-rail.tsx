"use client";

import { Inbox } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { QUEUE_STATUSES, type QueueStatusFilter } from "../lib/order-queue-filters";
import { mapOrderStatusLabel } from "../lib/order-status-display";
import { STATUS_META } from "./pos-order-queue-toolbar";

interface PosOrderStatusRailProps {
  counts: Record<string, number>;
  value: QueueStatusFilter;
  onChange: (value: QueueStatusFilter) => void;
}

/**
 * The split view's left column: one row per status with its live count. At `lg`
 * it is a vertical rail; below that it becomes a horizontally scrolling chip row
 * above the list, since three columns don't fit a phone or a portrait tablet.
 * Tapping the active status again clears it, same as the tiles it replaces.
 */
export function PosOrderStatusRail({ counts, value, onChange }: PosOrderStatusRailProps) {
  const { t } = useI18n();

  const base =
    "flex h-11 shrink-0 touch-manipulation items-center gap-2 rounded-lg border px-3 text-left text-xs font-medium transition-colors lg:w-full";
  const idle = "border-border bg-card text-foreground hover:border-foreground/20";
  const on = "border-primary bg-primary/10 text-foreground";

  return (
    <nav
      aria-label={t("pos.queue.statusRailLabel")}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <button
        type="button"
        aria-pressed={value === "ALL"}
        onClick={() => onChange("ALL")}
        className={cn(base, value === "ALL" ? on : idle)}
      >
        <Inbox className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t("pos.queue.all")}</span>
        <span className="text-sm font-bold tabular-nums">{counts.ALL ?? 0}</span>
      </button>

      {QUEUE_STATUSES.map((status) => {
        const { icon: Icon, color } = STATUS_META[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? "ALL" : status)}
            className={cn(base, active ? on : idle)}
          >
            <Icon className={cn("size-3.5 shrink-0", color)} />
            <span className="min-w-0 flex-1 truncate">{mapOrderStatusLabel(t, status)}</span>
            <span className="text-sm font-bold tabular-nums">{counts[status] ?? 0}</span>
          </button>
        );
      })}
    </nav>
  );
}
