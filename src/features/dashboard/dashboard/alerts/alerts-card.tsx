"use client";
import { memo, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useMaterials, type MaterialsResponse } from "@/features/dashboard/data/materials/hooks/use-materials";
import { ArrowRight, AlertCircle } from "lucide-react";
import DashboardCard from "../_components/dashboard-card";
import { SimpleLoadingSpinner } from "@/features/dashboard/shared/components/loading-states";
import { InlineErrorState } from "@/features/dashboard/shared/components/error-states";
import { InlineEmptyState } from "@/features/dashboard/shared/components/empty-states";

interface AlertsCardProps {
  data?: MaterialsResponse | null;
  isLoading?: boolean;
  error?: Error | null;
}

const AlertsCard = memo(function AlertsCard({ data: propsData, isLoading: propsIsLoading, error: propsError }: AlertsCardProps = {}) {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  // Use props if provided, otherwise fetch from API (backward compatibility)
  // TanStack Query will deduplicate requests with the same query key
  const materialsQuery = useMaterials(storeId || "");
  const data = propsData !== undefined ? propsData : materialsQuery.data;
  const isLoading = propsIsLoading !== undefined ? propsIsLoading : materialsQuery.isLoading;
  const error = propsError !== undefined ? propsError : materialsQuery.error;

  // Get low stock materials (currentStock <= minStock) and limit to 5
  const lowStockMaterials = useMemo(() => {
    if (!data?.materials) return [];

    return data.materials
      .map((material) => {
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
      })
      .filter((material) => material.currentStock <= material.minStock) // Only low stock
      .sort((a, b) => a.stockPercentage - b.stockPercentage) // Lowest first
      .slice(0, 5); // Show max 5 items
  }, [data]);

  const cardOther = (
    <Link href={`/store/${storeId}/alerts`}>
      <Button variant="ghost" size="sm" className="h-8 gap-1">
        {t("dashboard.alertsCard.viewAll")}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  // Early returns for loading/error/empty states using shared components
  if (!storeId) {
    return (
      <DashboardCard
        cardTitle={t("dashboard.alertsCard.title")}
        cardDescription={t("dashboard.alertsCard.description")}
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
        cardTitle={t("dashboard.alertsCard.title")}
        cardDescription={t("dashboard.alertsCard.description")}
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
        cardTitle={t("dashboard.alertsCard.title")}
        cardDescription={t("dashboard.alertsCard.description")}
        cardOther={cardOther}
        cardContent={
          <InlineErrorState
            error={error}
            title={t("common.error")}
            description={t("messages.errorLoadingMaterials")}
            className="min-h-[300px]"
          />
        }
      />
    );
  }

  if (lowStockMaterials.length === 0) {
    return (
      <DashboardCard
        cardTitle={t("dashboard.alertsCard.title")}
        cardDescription={t("dashboard.alertsCard.description")}
        cardOther={cardOther}
        cardContent={
          <InlineEmptyState
            icon={AlertCircle}
            title={t("dashboard.alertsCard.noCriticalAlerts")}
            className="min-h-[300px]"
          />
        }
      />
    );
  }

  const cardContent = (
    <div className="flex min-h-[300px] flex-1 flex-col">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
        {/* Table Header */}
        <div className="from-foreground/90 to-foreground/80 text-background flex shrink-0 bg-gradient-to-r px-3 py-2 text-xs font-bold">
          <div className="w-2/5">{t("dashboard.alertsCard.material")}</div>
          <div className="w-2/5 text-center">{t("dashboard.alertsCard.stockLevel")}</div>
          <div className="w-1/5 text-right">{t("dashboard.alertsCard.current")}</div>
        </div>

        {/* Table Body */}
        <div className="divide-border flex-1 divide-y overflow-y-auto">
          {lowStockMaterials.map((material) => {
            return (
              <div
                key={material.id}
                className="hover:bg-muted/30 flex items-center px-3 py-2.5 text-sm transition-colors"
              >
                <div className="w-2/5 truncate font-medium">{material.name}</div>
                <div className="w-2/5 px-2">
                  <Progress
                    value={Math.min(material.stockPercentage, 100)}
                    className="bg-muted [&>div]:bg-destructive h-2"
                  />
                </div>
                <div className="w-1/5 text-right font-semibold text-red-600 dark:text-red-400">
                  {material.currentStock} {material.unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardCard
      cardTitle={t("dashboard.alertsCard.title")}
      cardDescription={t("dashboard.alertsCard.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
});

export default AlertsCard;
