"use client";
import { memo } from "react";
import PageHeader from "./page-header";
import ProductionHistoryChart from "../production-history/production-history-chart";
import AlertsCard from "../alerts/alerts-card";
import TrackingCard from "../tracking/tracking-card";
import SupplierCard from "../supplier/supplier-card";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useDashboardData } from "../hooks/use-dashboard-data";

export const DashboardView = memo(function DashboardView() {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();
  const dashboardData = useDashboardData(storeId);

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full gap-6">
      <PageHeader pageTitle={t("dashboard.title")} pageDescription={t("dashboard.description")} />

      {/* Top Stats */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7 lg:items-stretch">
        <div className="w-full md:col-span-2 lg:col-span-4">
          <ProductionHistoryChart
            data={dashboardData.productionBatches}
            isLoading={dashboardData.isLoadingProductionBatches}
            error={dashboardData.productionBatchesError}
          />
        </div>
        <div className="w-full md:col-span-2 lg:col-span-3">
          <AlertsCard
            data={dashboardData.materials}
            isLoading={dashboardData.isLoadingMaterials}
            error={dashboardData.materialsError}
          />
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid w-full gap-4 md:grid-cols-2">
        <TrackingCard
          data={dashboardData.materials}
          isLoading={dashboardData.isLoadingMaterials}
          error={dashboardData.materialsError}
        />
        <SupplierCard
          data={dashboardData.suppliers}
          isLoading={dashboardData.isLoadingSuppliers}
          error={dashboardData.suppliersError}
        />
      </div>
    </div>
  );
});
