"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { QUEUE_SOURCE_TABS, type QueueSourceTab } from "../lib/order-queue-filters";

interface PosOrderSourceTabsProps {
  value: QueueSourceTab;
  onChange: (value: QueueSourceTab) => void;
  /** Open orders per tab — independent of the search/status/other filters. */
  counts: Record<QueueSourceTab, number>;
  className?: string;
}

/**
 * The POS / Online-ordering switch above the queue, each with its open-order
 * count. There is deliberately no "All": walk-in and online orders are worked
 * separately, so the Online badge turns red while anything is waiting there —
 * that badge is how a cashier on the POS tab knows an online order came in.
 */
export function PosOrderSourceTabs({
  value,
  onChange,
  counts,
  className,
}: PosOrderSourceTabsProps) {
  const { t } = useI18n();
  const labels: Record<QueueSourceTab, string> = {
    POS: t("pos.queue.tabPos"),
    ONLINE: t("pos.queue.tabOnline"),
  };

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as QueueSourceTab)} className={className}>
      {/* h-11: each trigger is a ~42px tap target, above the 40px floor. */}
      <TabsList
        aria-label={t("pos.queue.sourceTabsLabel")}
        className="grid h-11 w-full max-w-md grid-cols-2"
      >
        {QUEUE_SOURCE_TABS.map((tab) => {
          const attention = tab === "ONLINE" && counts[tab] > 0;
          return (
            <TabsTrigger key={tab} value={tab} className="min-w-0 gap-2 px-3">
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
    </Tabs>
  );
}
