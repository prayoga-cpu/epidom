"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosOrderQueue } from "./pos-order-queue";
import { OrderHistoryTab } from "./order-history-tab";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";

interface PosOrdersTabsProps {
  storeId: string;
}

interface OrdersTabState {
  tab: "active" | "history";
}

const ORDERS_TAB_DEFAULTS: OrdersTabState = { tab: "active" };

function sanitizeOrdersTab(raw: unknown, defaults: OrdersTabState): OrdersTabState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<OrdersTabState>;
  return { tab: r.tab === "active" || r.tab === "history" ? r.tab : defaults.tab };
}

export function PosOrdersTabs({ storeId }: PosOrdersTabsProps) {
  const { t } = useI18n();
  const [{ tab }, setTabState] = usePersistedState(
    `epidom-pos-orders-tab-${storeId}`,
    ORDERS_TAB_DEFAULTS,
    sanitizeOrdersTab
  );

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

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTabState({ tab: v as "active" | "history" })}
      className="flex flex-1 flex-col"
    >
      <TabsList className="bg-muted/50 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="active"
        >
          {t("pos.history.activeTab")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="history"
        >
          {t("pos.history.historyTab")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        <PosOrderQueue storeId={storeId} />
      </TabsContent>
      <TabsContent value="history">
        <OrderHistoryTab storeId={storeId} />
      </TabsContent>
    </Tabs>
  );
}
