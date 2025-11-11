"use client";
import { useI18n } from "@/components/lang/i18n-provider";
import { ExportButton } from "@/components/ui/export-button";
import DashboardCard from "../_components/dashboard-card";
import Chart from "./components/chart";
import { useMemo } from "react";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useProductionBatches } from "@/features/dashboard/management/recipe-production/hooks/use-production-batches";
import { exportData } from "@/features/dashboard/dashboard/production-history/utils/export";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { Loader2 } from "lucide-react";

export default function ProductionHistoryChart() {
  const { t, locale } = useI18n();
  const { storeId } = useCurrentStore();
  const { advancedReportsAccess } = useFeatureAccess();

  const { data, isLoading } = useProductionBatches(storeId, {
    sortBy: "scheduledDate",
    sortOrder: "desc",
    skip: 0,
    take: 10, // Just get 10 most recent batches
  });

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

  return (
    <DashboardCard
      cardTitle={t("pages.prodHistory")}
      cardDescription={t("pages.prodHistoryDesc")}
      cardOther={
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
      }
      cardContent={
        isLoading ? (
          <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center">
            <Loader2 className="text-muted-foreground mb-3 h-8 w-8 animate-spin" />
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-1">
          <Chart chartData={chartData} />
          </div>
        )
      }
    />
  );
}
