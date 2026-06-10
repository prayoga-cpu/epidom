"use client";

import type { SerializeDecimal } from "@/types/prisma";
import { useI18n } from "@/components/lang/i18n-provider";
import { StockLevelsTab } from "./stock-levels-tab";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";

interface TrackingClientProps {
  initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[];
  storeId: string;
}

export function TrackingClient({ initialMaterials, storeId }: TrackingClientProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{t("nav.tracking")}</h1>
          <p className="text-muted-foreground text-sm">{t("pages.trackingStatus")}</p>
        </div>
      </div>

      <StockLevelsTab initialMaterials={initialMaterials} />
    </div>
  );
}

