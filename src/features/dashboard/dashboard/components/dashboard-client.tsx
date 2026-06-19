"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "./page-header";
import { ChartSkeleton } from "./chart-skeleton";
import { CardSkeleton } from "./card-skeleton";
import { AlertsCard } from "../alerts/alerts-card";
import { TrackingCard } from "../tracking/tracking-card";
import { useI18n } from "@/components/lang/i18n-provider";

import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import type { ProductionBatchWithRelations } from "@/lib/repositories/production-batch.repository";
import type { Alert } from "@/features/dashboard/tracking/hooks/use-alerts";

// Lazy load heavy chart component to reduce initial bundle size (~200KB savings)
// Use Next.js dynamic with ssr: false to prevent hydration mismatch
const ProductionHistoryChart = dynamic(
  () =>
    import("../production-history/production-history-chart").then((mod) => ({
      default: mod.ProductionHistoryChart,
    })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

// Lazy load below-the-fold component for progressive loading
const SupplierCard = dynamic(
  () =>
    import("../supplier/supplier-card").then((mod) => ({
      default: mod.SupplierCard,
    })),
  {
    loading: () => <CardSkeleton rows={3} />,
    ssr: false,
  }
);

const RecentMovementsCard = dynamic(
  () =>
    import("../recent-movements/recent-movements-card").then((mod) => ({
      default: mod.RecentMovementsCard,
    })),
  {
    loading: () => <CardSkeleton rows={5} />,
    ssr: false,
  }
);

interface DashboardClientProps {
  initialStockLevels: MaterialWithSuppliers[];
  initialSuppliers: SupplierWithRelations[];
  initialProductionBatches: ProductionBatchWithRelations[];
  initialAlerts: Alert[];
  storeId: string;
}

export function DashboardClient({
  initialStockLevels,
  initialSuppliers,
  initialProductionBatches,
  initialAlerts,
  storeId,
}: DashboardClientProps) {
  const { t } = useI18n();

  // Process data for TrackingCard (calculate percentage once)
  const stockLevels = useMemo(() => {
    return initialStockLevels.map((material) => {
      const currentStock = Number(material.currentStock);
      const minStock = Number(material.minStock);
      const maxStock = Number(material.maxStock);
      const stockPercentage = maxStock > 0 ? (currentStock / maxStock) * 100 : 0;

      return {
        id: material.id,
        name: material.name,
        currentStock,
        minStock,
        maxStock,
        unit: material.unit,
        stockPercentage,
      };
    });
  }, [initialStockLevels]);

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full gap-6">
      <PageHeader pageTitle={t("dashboard.title")} pageDescription={t("dashboard.description")} />

      {/* Top Stats */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7 lg:items-stretch">
        <div className="w-full md:col-span-2 lg:col-span-4">
          <ProductionHistoryChart />
        </div>
        <div className="w-full md:col-span-2 lg:col-span-3">
          <AlertsCard initialAlerts={initialAlerts} storeId={storeId} />
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid w-full gap-4 md:grid-cols-2">
        <TrackingCard stockLevels={stockLevels} />
        <SupplierCard />
      </div>

      {/* Recent Stock Movements — POS sales, production, manual adjustments */}
      <div className="w-full">
        <RecentMovementsCard />
      </div>
    </div>
  );
}
