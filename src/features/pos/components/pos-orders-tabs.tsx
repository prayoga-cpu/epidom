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
      <TabsList>
        <TabsTrigger value="active">{t("pos.history.activeTab")}</TabsTrigger>
        <TabsTrigger value="history">{t("pos.history.historyTab")}</TabsTrigger>
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
