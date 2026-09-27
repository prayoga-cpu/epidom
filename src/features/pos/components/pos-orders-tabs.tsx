"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { History, Power } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PosOrderQueue } from "./pos-order-queue";
import { PosOrderSourceTabs } from "./pos-order-source-tabs";
import { OrderHistoryTab } from "./order-history-tab";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useKdsSettings, useUpdateKdsSettings } from "../hooks/use-kds-settings";
import { useOrderQueueState } from "../hooks/use-order-queue-state";
import { toSourceTab } from "../lib/order-queue-filters";

interface PosOrdersTabsProps {
  storeId: string;
  /** Whether the current session may flip the Active Queue toggle — owner
   * only, same rule as the Kitchen & Bar page (see pos/kds/page.tsx). */
  canManageSettings: boolean;
}

// Stored as before: "active" is the queue (which of POS / Online ordering lives
// in the queue's own saved filters), "history" is the Log.
interface OrdersTabState {
  tab: "active" | "history";
}

/** The Tabs value of the Log (History) trigger; the queue's are "POS" / "ONLINE". */
const LOG_TAB = "log";

// Same look as the Stock page's Item | Delivery Order + Log bar (management-client.tsx).
const TAB_LIST_CLASS = "bg-muted/50 h-auto gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm";
const TAB_TRIGGER_CLASS =
  "data-[state=active]:bg-card h-10 w-full min-w-0 justify-center px-2 text-xs transition-all data-[state=active]:shadow-md md:px-3 md:text-sm";

const ORDERS_TAB_DEFAULTS: OrdersTabState = { tab: "active" };

function sanitizeOrdersTab(raw: unknown, defaults: OrdersTabState): OrdersTabState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<OrdersTabState>;
  return { tab: r.tab === "active" || r.tab === "history" ? r.tab : defaults.tab };
}

export function PosOrdersTabs({ storeId, canManageSettings }: PosOrdersTabsProps) {
  const { t } = useI18n();
  const [{ tab }, setTabState] = usePersistedState(
    `epidom-pos-orders-tab-${storeId}`,
    ORDERS_TAB_DEFAULTS,
    sanitizeOrdersTab
  );
  // The queue's filters live up here: its POS / Online ordering tabs are this
  // page's top bar, and their counts stay up while the Log is open.
  const queue = useOrderQueueState(storeId);

  // Same store-wide setting as the Kitchen & Bar page's toggle
  // (kitchenDisplayEnabled) — surfaced here as "Active Queue" since flipping
  // it off also empties the Active tab (see PosOrderQueue) and turns off
  // Kitchen & Bar, and vice versa. One shared switch, two labels.
  const { data: kdsSettings } = useKdsSettings(storeId);
  const updateSettings = useUpdateKdsSettings(storeId);
  const activeQueueEnabled = kdsSettings?.kitchenDisplayEnabled ?? true;

  const handleToggle = async (checked: boolean) => {
    try {
      await updateSettings.mutateAsync(checked);
      toast.success(checked ? t("pos.queue.activeQueueEnabledToast") : t("pos.queue.activeQueueDisabledToast"));
    } catch {
      toast.error(t("pos.kds.settingsUpdateFailed"));
    }
  };

  // A ?unpaid=1 link (the POS unpaid-orders alert) should always land on the
  // Active queue — that's the only tab PosOrderQueue's own unpaid filter
  // applies to. Without this, a cashier who last left the History tab open
  // gets stranded there since usePersistedState's saved tab wins by default.
  // Runs after that load effect (registered first, so it fires first on
  // mount), so this write overrides it rather than the other way around.
  // Symmetric to ?unpaid=1 above — the printer menu's "Order History" link
  // (for reprinting a past order) always wants the History tab, regardless
  // of whichever tab the cashier last had open.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("unpaid") === "1") {
      setTabState({ tab: "active" });
    } else if (searchParams.get("tab") === "history") {
      setTabState({ tab: "history" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // POS / Online ordering pick the queue's source; Log opens History.
  const tabValue = tab === "history" ? LOG_TAB : queue.filters.sourceFilter;
  const handleTabChange = (value: string) => {
    if (value === LOG_TAB) {
      setTabState({ tab: "history" });
      return;
    }
    setTabState({ tab: "active" });
    queue.patchFilters({ sourceFilter: toSourceTab(value) });
  };

  // Manual activation: with two tab lists, Tab-key focus moves from the
  // POS / Online bar straight onto Log, and automatic activation would switch
  // to it on the way past. A tab opens on click, tap or Enter.
  return (
    <Tabs
      value={tabValue}
      onValueChange={handleTabChange}
      activationMode="manual"
      className="flex flex-1 flex-col"
    >
      <div className="flex items-center gap-3">
        <PosOrderSourceTabs
          counts={queue.sourceCounts}
          listClassName={cn(TAB_LIST_CLASS, "min-w-0 flex-1")}
          triggerClassName={TAB_TRIGGER_CLASS}
        />
        {/* A second list under the same Tabs root: it drives the same value
            and content panels, but reads as its own control. */}
        <TabsList className={cn(TAB_LIST_CLASS, "shrink-0")}>
          <TabsTrigger className={cn(TAB_TRIGGER_CLASS, "px-3")} value={LOG_TAB}>
            <History />
            {t("pos.history.logTab")}
          </TabsTrigger>
        </TabsList>
      </div>

      {canManageSettings && (
        // ml-6 = the p-6 the queue/history content below uses, so it lines up
        // with the search box beneath it instead of sitting flush against the
        // edge of the screen.
        <div className="mt-1 ml-6 flex items-center gap-2">
          <Power className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm">{t("pos.queue.activeQueueLabel")}</span>
          <Switch
            checked={activeQueueEnabled}
            onCheckedChange={handleToggle}
            disabled={updateSettings.isPending}
          />
        </div>
      )}
      {/* The queue's panel takes whichever source is picked, so switching POS ⇄
          Online keeps the same queue mounted (its search box included). */}
      <TabsContent value={queue.filters.sourceFilter}>
        <PosOrderQueue storeId={storeId} queue={queue} />
      </TabsContent>
      <TabsContent value={LOG_TAB}>
        <OrderHistoryTab storeId={storeId} />
      </TabsContent>
    </Tabs>
  );
}
