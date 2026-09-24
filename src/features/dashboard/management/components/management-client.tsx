"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditStockCard } from "../edit-stock/edit-stock";
import { ReorderPanel } from "../edit-stock/reorder/reorder-panel";
import { MovementsTab } from "../movements/movements-tab";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { cn } from "@/lib/utils";
import { type SupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";

// "log" (the stock movement ledger) sits in its own tab list beside the
// Item | Delivery Order bar: same look as a tab, but a separate control.
type ManagementTab = "item" | "delivery" | "log";

interface TabState {
  tab: ManagementTab;
}

const TAB_DEFAULTS: TabState = { tab: "item" };

/** Reads a stored or `?tab=` value. "stock" and "history" are the old names. */
function parseTab(value: unknown): ManagementTab | null {
  if (value === "item" || value === "stock") return "item";
  if (value === "log" || value === "history") return "log";
  if (value === "delivery") return "delivery";
  return null;
}

function sanitizeTabState(raw: unknown, defaults: TabState): TabState {
  if (!raw || typeof raw !== "object") return defaults;
  return { tab: parseTab((raw as Partial<TabState>).tab) ?? defaults.tab };
}

const TAB_LIST_CLASS = "bg-muted/50 h-auto gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm";

const TAB_TRIGGER_CLASS =
  "data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:px-3 md:text-sm";

interface ManagementClientProps {
  initialSupplierOrders?: SupplierOrder[];
  storeId: string;
}

export function ManagementClient({ initialSupplierOrders, storeId }: ManagementClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tabState, setTabState] = usePersistedState<TabState>(
    `epidom-management-tab-${storeId}`,
    TAB_DEFAULTS,
    sanitizeTabState
  );

  // Alerts deep-links (?highlight= / ?supplierId=) open an order dialog that
  // lives on the Delivery Order tab.
  const highlightMaterialId = searchParams.get("highlight");
  const highlightSupplierId = searchParams.get("supplierId");
  const activeTab: ManagementTab =
    highlightMaterialId || highlightSupplierId
      ? "delivery"
      : (parseTab(searchParams.get("tab")) ?? tabState.tab);

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as ManagementTab;
      setTabState({ tab });
      // Drop any deep-link params once the user navigates manually, and
      // reflect the choice in the URL so it can be shared/bookmarked.
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.delete("highlight");
      params.delete("supplierId");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, setTabState]
  );

  // Pins `tab=delivery` while dropping the deep-link params, so closing the
  // deep-linked dialog leaves the user where they are instead of falling back
  // to whichever tab they last had open.
  const clearHighlight = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("highlight");
    params.delete("supplierId");
    params.set("tab", "delivery");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <div className="min-h-[calc((100vh-150px)/var(--app-zoom,1))] space-y-4">
      {/* Manual activation: with two tab lists, Tab-key focus moves from the
          Item/Delivery bar straight onto Log, and automatic activation would
          switch to it on the way past. A tab opens on click, tap or Enter. */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        activationMode="manual"
        className="w-full"
      >
        <div className="flex items-center gap-3">
          <TabsList className={cn(TAB_LIST_CLASS, "grid min-w-0 flex-1 grid-cols-2")}>
            <TabsTrigger className={TAB_TRIGGER_CLASS} value="item">
              {t("management.item")}
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER_CLASS} value="delivery">
              {t("management.deliveryOrder")}
            </TabsTrigger>
          </TabsList>

          {/* A second list under the same Tabs root: it drives the same value
              and content panels, but reads as its own control. */}
          <TabsList className={cn(TAB_LIST_CLASS, "shrink-0")}>
            <TabsTrigger className={cn(TAB_TRIGGER_CLASS, "px-3")} value="log">
              <History />
              {t("management.log")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="item" className="space-y-4">
          <EditStockCard />
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <ReorderPanel
            storeId={storeId}
            initialSupplierOrders={initialSupplierOrders}
            highlightMaterialId={highlightMaterialId}
            highlightSupplierId={highlightSupplierId}
            onHighlightConsumed={clearHighlight}
          />
        </TabsContent>

        <TabsContent value="log" className="space-y-4">
          <MovementsTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
