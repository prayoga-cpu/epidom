"use client";
import { memo, useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { ExportButton } from "@/components/ui/export-button";
import DashboardCard from "../_components/dashboard-card";
import Chart from "./components/chart";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useProductionBatches, type ProductionBatchesResponse } from "@/features/dashboard/management/recipe-production/hooks/use-production-batches";
import { exportData } from "@/features/dashboard/dashboard/production-history/utils/export";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { SimpleLoadingSpinner } from "@/features/dashboard/shared/components/loading-states";
import { InlineErrorState } from "@/features/dashboard/shared/components/error-states";

interface ProductionHistoryChartProps {
  data?: ProductionBatchesResponse | null;
  isLoading?: boolean;
  error?: Error | null;
}

const ProductionHistoryChart = memo(function ProductionHistoryChart({ data: propsData, isLoading: propsIsLoading, error: propsError }: ProductionHistoryChartProps = {}) {
  const { t, locale } = useI18n();
  const { storeId } = useCurrentStore();
  const { advancedReportsAccess } = useFeatureAccess();

  // Use props if provided, otherwise fetch from API (backward compatibility)
  const productionBatchesQuery = useProductionBatches(storeId || "", {
    sortBy: "scheduledDate",
    sortOrder: "desc",
    skip: 0,
    take: 10, // Just get 10 most recent batches
  });
  const data = propsData !== undefined ? propsData : productionBatchesQuery.data;
  const isLoading = propsIsLoading !== undefined ? propsIsLoading : productionBatchesQuery.isLoading;
  const error = propsError !== undefined ? propsError : productionBatchesQuery.error;

  // Transform production batches into chart data
  const chartData = useMemo(() => {
    if (!data?.batches) return [];

    // Group batches by day
    const dailyData = new Map<string, number>();

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      dailyData.set(dateKey, 0);
    }

    // Aggregate production data by day
    data.batches.forEach((batch) => {
      // Use completedDate if available, otherwise use scheduledDate
      const batchDate = batch.completedDate
        ? new Date(batch.completedDate)
        : batch.scheduledDate
          ? new Date(batch.scheduledDate)
          : null;

      if (!batchDate) return;

      const dateKey = batchDate.toISOString().split("T")[0];
      if (dailyData.has(dateKey)) {
        const current = dailyData.get(dateKey)!;
        // Use actualQuantity if available, otherwise use plannedQuantity
        const quantity = Number(batch.actualQuantity || batch.plannedQuantity || 0);
        dailyData.set(dateKey, current + quantity);
      }
    });

    // Convert to chart format
    // Map locale to browser locale format
    const localeMap: Record<string, string> = {
      en: "en-US",
      fr: "fr-FR",
      id: "id-ID",
    };
    const browserLocale = localeMap[locale] || "en-US";

    return Array.from(dailyData.entries()).map(([dateKey, quantity]) => {
      const date = new Date(dateKey);
      return {
        date: date.toLocaleDateString(browserLocale, { weekday: "short" }),
        quantity,
      };
    });
  }, [data, locale]);

  const cardOther = (
    <ExportButton
      data={exportData({ chartData })}
      filename="production-history"
      variant="outline"
      size="sm"
      disabled={!advancedReportsAccess}
      title={
        !advancedReportsAccess
          ? "Advanced Reports is only available in Pro and Enterprise plans"
          : undefined
      }
    />
  );

  // Early returns for loading/error states using shared components
  if (!storeId) {
    return (
      <DashboardCard
        cardTitle={t("pages.prodHistory")}
        cardDescription={t("pages.prodHistoryDesc")}
        cardOther={cardOther}
        cardContent={
          <SimpleLoadingSpinner message={t("common.loading")} className="min-h-[300px]" />
        }
      />
    );
  }

  if (isLoading) {
    return (
      <DashboardCard
        cardTitle={t("pages.prodHistory")}
        cardDescription={t("pages.prodHistoryDesc")}
        cardOther={cardOther}
        cardContent={
          <SimpleLoadingSpinner message={t("common.loading")} className="min-h-[300px]" />
        }
      />
    );
  }

  if (error) {
    return (
      <DashboardCard
        cardTitle={t("pages.prodHistory")}
        cardDescription={t("pages.prodHistoryDesc")}
        cardOther={cardOther}
        cardContent={
          <InlineErrorState
            error={error}
            title={t("common.error")}
            className="min-h-[300px]"
          />
        }
      />
    );
  }

  return (
    <DashboardCard
      cardTitle={t("pages.prodHistory")}
      cardDescription={t("pages.prodHistoryDesc")}
      cardOther={cardOther}
      cardContent={
        <div className="flex min-h-[300px] flex-1">
          <Chart chartData={chartData} />
        </div>
      }
    />
  );
});

export default ProductionHistoryChart;
