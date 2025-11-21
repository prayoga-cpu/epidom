"use client";
import { useMemo, lazy, Suspense } from "react";
import { PageHeader } from "./page-header";
import { ChartSkeleton } from "./chart-skeleton";
import { CardSkeleton } from "./card-skeleton";
import AlertsCard from "../alerts/alerts-card";
import TrackingCard from "../tracking/tracking-card";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";

// Lazy load heavy chart component to reduce initial bundle size (~200KB savings)
const ProductionHistoryChart = lazy(() => import("../production-history/production-history-chart"));

// Lazy load below-the-fold component for progressive loading
const SupplierCard = lazy(() => import("../supplier/supplier-card"));

export function DashboardView() {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  // Lift materials fetching to parent to avoid duplicate API calls
  // Both AlertsCard and TrackingCard need materials data
  const materialsQuery = useMaterials(storeId || "");

  // Process materials data once in parent to avoid duplicate computations
  // This replaces the heavy map/filter/sort operations in each child component
  const processedMaterials = useMemo(() => {
    if (!materialsQuery.data?.materials) {
      return {
        lowStockMaterials: [],
        stockLevels: [],
      };
    }

    // Transform all materials with calculated stock data (do this once, not twice)
    const transformedMaterials = materialsQuery.data.materials.map((material) => {
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

    // Low stock materials for AlertsCard (currentStock <= minStock)
    const lowStockMaterials = transformedMaterials
      .filter((material) => material.currentStock <= material.minStock)
      .sort((a, b) => a.stockPercentage - b.stockPercentage) // Lowest first
      .slice(0, 5); // Top 5

    // Stock levels for TrackingCard (all materials sorted by stock percentage)
    const stockLevels = transformedMaterials
      .sort((a, b) => a.stockPercentage - b.stockPercentage) // Lowest first
      .slice(0, 5); // Top 5

    return {
      lowStockMaterials,
      stockLevels,
    };
  }, [materialsQuery.data]);

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full gap-6">
      <PageHeader pageTitle={t("dashboard.title")} pageDescription={t("dashboard.description")} />

      {/* Top Stats */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7 lg:items-stretch">
        <div className="w-full md:col-span-2 lg:col-span-4">
          <Suspense fallback={<ChartSkeleton />}>
            <ProductionHistoryChart />
          </Suspense>
        </div>
        <div className="w-full md:col-span-2 lg:col-span-3">
          <AlertsCard
            materialsQuery={materialsQuery}
            processedData={processedMaterials.lowStockMaterials}
          />
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid w-full gap-4 md:grid-cols-2">
        <TrackingCard
          materialsQuery={materialsQuery}
          processedData={processedMaterials.stockLevels}
        />
        <Suspense fallback={<CardSkeleton title={t("dashboard.supplierCard.title")} description={t("dashboard.supplierCard.description")} rows={3} />}>
          <SupplierCard />
        </Suspense>
      </div>
    </div>
  );
}
