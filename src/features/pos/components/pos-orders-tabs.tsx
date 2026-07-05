"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosOrderQueue } from "./pos-order-queue";
import { OrderHistoryTab } from "./order-history-tab";

interface PosOrdersTabsProps {
  storeId: string;
}

export function PosOrdersTabs({ storeId }: PosOrdersTabsProps) {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="active" className="flex flex-1 flex-col">
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
