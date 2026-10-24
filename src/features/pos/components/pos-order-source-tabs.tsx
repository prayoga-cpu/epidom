"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { QUEUE_SOURCE_TABS, type QueueSourceTab } from "../lib/order-queue-filters";

interface PosOrderSourceTabsProps {
  /** Open orders per tab — independent of the search/status/other filters. */
  counts: Record<QueueSourceTab, number>;
  listClassName?: string;
  triggerClassName?: string;
  /** Active Queue off: both tabs stay visible but can't be opened. */
  disabled?: boolean;
}

/**
 * The POS / Online-ordering pair at the top of the Order Queue page, each with
 * its open-order count. Only the list: it sits under the page's own <Tabs> root
 * (PosOrdersTabs) beside the separate Log list, so the three drive one value.
 *
 * There is deliberately no "All": walk-in and online orders are worked
 * separately, so the Online badge turns red while anything is waiting there —
 * that badge is how a cashier on the POS tab (or reading the Log) knows an
 * online order came in.
 *
 * With the Active Queue off there is no queue to show: the page is the Log
 * alone, and the two tabs stay in place, disabled, with the reason as a hint.
 */
export function PosOrderSourceTabs({
  counts,
  listClassName,
  triggerClassName,
  disabled = false,
}: PosOrderSourceTabsProps) {
  const { t } = useI18n();
  const labels: Record<QueueSourceTab, string> = {
    POS: t("pos.queue.tabPos"),
    ONLINE: t("pos.queue.tabOnline"),
  };

  return (
    // The hint sits on the list: a disabled button gets no pointer events, so
    // its own title would never show.
    <TabsList
      aria-label={t("pos.queue.sourceTabsLabel")}
      className={listClassName}
      title={disabled ? t("pos.queue.sourceTabsOffHint") : undefined}
    >
      {QUEUE_SOURCE_TABS.map((tab) => {
        const attention = !disabled && tab === "ONLINE" && counts[tab] > 0;
        return (
          <TabsTrigger
            key={tab}
            value={tab}
            disabled={disabled}
            className={cn("gap-2", triggerClassName)}
          >
            <span className="truncate">{labels[tab]}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs leading-none font-semibold tabular-nums",
                attention ? "bg-destructive text-white" : "bg-foreground/10 text-foreground"
              )}
            >
              {counts[tab]}
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
