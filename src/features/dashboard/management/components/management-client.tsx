"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditStockCard } from "../edit-stock/edit-stock";
import { MovementsTab } from "../movements/movements-tab";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { type SupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";

type ManagementTab = "stock" | "history";

interface TabState {
  tab: ManagementTab;
}

const TAB_DEFAULTS: TabState = { tab: "stock" };

function sanitizeTabState(raw: unknown, defaults: TabState): TabState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<TabState>;
  return { tab: r.tab === "history" ? "history" : "stock" };
}

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

  const highlightMaterialId = searchParams.get("highlight");
  const highlightSupplierId = searchParams.get("supplierId");
  const urlTab = searchParams.get("tab");
  const activeTab: ManagementTab = highlightMaterialId || highlightSupplierId
    ? "stock"
    : urlTab === "history"
      ? "history"
      : urlTab === "stock"
        ? "stock"
        : tabState.tab;

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

  const clearHighlight = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("highlight");
    params.delete("supplierId");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/50 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="stock"
          >
            {t("management.stock")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="history"
          >
            {t("management.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <EditStockCard
            initialSupplierOrders={initialSupplierOrders}
            highlightMaterialId={highlightMaterialId}
            highlightSupplierId={highlightSupplierId}
            onHighlightConsumed={clearHighlight}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <MovementsTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
