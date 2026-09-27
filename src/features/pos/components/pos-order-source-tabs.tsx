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
 */
export function PosOrderSourceTabs({
  counts,
  listClassName,
  triggerClassName,
}: PosOrderSourceTabsProps) {
  const { t } = useI18n();
  const labels: Record<QueueSourceTab, string> = {
    POS: t("pos.queue.tabPos"),
    ONLINE: t("pos.queue.tabOnline"),
  };

  return (
    <TabsList
      aria-label={t("pos.queue.sourceTabsLabel")}
      className={cn("grid grid-cols-2", listClassName)}
    >
      {QUEUE_SOURCE_TABS.map((tab) => {
        const attention = tab === "ONLINE" && counts[tab] > 0;
        return (
          <TabsTrigger key={tab} value={tab} className={cn("gap-2", triggerClassName)}>
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
