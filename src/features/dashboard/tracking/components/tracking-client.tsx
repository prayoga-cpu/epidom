"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockLevelsTab } from "./stock-levels-tab";
import { MovementsTab } from "./movements-tab";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";

interface TrackingClientProps {
  initialMaterials?: MaterialWithSuppliers[];
  storeId: string;
}

export function TrackingClient({ initialMaterials, storeId }: TrackingClientProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t("nav.tracking")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pages.trackingStatus")}</p>
        </div>
      </div>

      <Tabs defaultValue="levels">
        <TabsList className="bg-muted/50 mb-4 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="levels"
          >
            {t("tracking.tabs.levels") || "Stock Levels"}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="movements"
          >
            {t("tracking.tabs.movements") || "Recent Movements"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="levels">
          <StockLevelsTab initialMaterials={initialMaterials} />
        </TabsContent>

        <TabsContent value="movements">
          <MovementsTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
