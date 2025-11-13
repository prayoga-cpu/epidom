"use client";
import { memo, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/lang/i18n-provider";
import { ArrowRight, Package } from "lucide-react";
import DashboardCard from "../_components/dashboard-card";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useMaterials, type MaterialsResponse } from "@/features/dashboard/data/materials/hooks/use-materials";
import { SimpleLoadingSpinner } from "@/features/dashboard/shared/components/loading-states";
import { InlineErrorState } from "@/features/dashboard/shared/components/error-states";
import { InlineEmptyState } from "@/features/dashboard/shared/components/empty-states";

interface TrackingCardProps {
  data?: MaterialsResponse | null;
  isLoading?: boolean;
  error?: Error | null;
}

const TrackingCard = memo(function TrackingCard({ data: propsData, isLoading: propsIsLoading, error: propsError }: TrackingCardProps = {}) {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  // Use props if provided, otherwise fetch from API (backward compatibility)
  const materialsQuery = useMaterials(storeId || "");
  const data = propsData !== undefined ? propsData : materialsQuery.data;
  const isLoading = propsIsLoading !== undefined ? propsIsLoading : materialsQuery.isLoading;
  const error = propsError !== undefined ? propsError : materialsQuery.error;

  // Get materials with stock data, sorted by stock percentage
  const stockLevels = useMemo(() => {
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
      .sort((a, b) => a.stockPercentage - b.stockPercentage) // Low stock first
      .slice(0, 5); // Show max 5 items
  }, [data]);

  const cardOther = (
    <Link href={`/store/${storeId}/tracking`}>
      <Button variant="ghost" size="sm" className="h-8 gap-1">
        {t("dashboard.trackingCard.viewAll")}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  // Early returns for loading/error/empty states using shared components
  if (!storeId) {
    return (
      <DashboardCard
        cardTitle={t("dashboard.trackingCard.title")}
        cardDescription={t("dashboard.trackingCard.description")}
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
        cardTitle={t("dashboard.trackingCard.title")}
        cardDescription={t("dashboard.trackingCard.description")}
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
        cardTitle={t("dashboard.trackingCard.title")}
        cardDescription={t("dashboard.trackingCard.description")}
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

  if (stockLevels.length === 0) {
    return (
      <DashboardCard
        cardTitle={t("dashboard.trackingCard.title")}
        cardDescription={t("dashboard.trackingCard.description")}
        cardOther={cardOther}
        cardContent={
          <InlineEmptyState
            icon={Package}
            title={t("dashboard.trackingCard.noStockData")}
            className="min-h-[300px]"
          />
        }
      />
    );
  }

  const cardContent = (
    <div className="h-full overflow-auto">
      <div className="overflow-hidden rounded-lg border">
        {/* Table Header */}
        <div className="from-foreground/90 to-foreground/80 text-background flex bg-gradient-to-r px-3 py-2 text-xs font-bold">
          <div className="w-1/5">{t("dashboard.trackingCard.material")}</div>
          <div className="w-3/5 text-center">{t("dashboard.trackingCard.stockLevel")}</div>
          <div className="w-1/5 text-right">{t("dashboard.trackingCard.current")}</div>
        </div>

        {/* Table Body */}
        <div className="divide-border divide-y">
          {stockLevels.map((item) => {
            // Determine color based on stock levels
            let progressColor = "[&>div]:bg-gray-500"; // Default: between min and max (gray)
            let textColor = "text-foreground";

            if (item.currentStock <= item.minStock) {
              // Red: stock at or below minimum
              progressColor = "[&>div]:bg-destructive";
              textColor = "text-red-600 dark:text-red-400";
            } else if (item.currentStock >= item.maxStock) {
              // Black: stock at or above maximum
              progressColor = "[&>div]:bg-black dark:[&>div]:bg-white";
              textColor = "text-foreground";
            }

            return (
              <div
                key={item.id}
                className="hover:bg-muted/30 flex items-center px-3 py-2.5 text-sm transition-colors"
              >
                <div className="w-1/5 truncate font-medium">{item.name}</div>
                <div className="w-3/5 px-2">
                  <Progress
                    value={Math.min(item.stockPercentage, 100)}
                    className={`bg-muted h-2 ${progressColor}`}
                  />
                </div>
                <div className={`w-1/5 text-right font-semibold ${textColor}`}>
                  {item.currentStock} {item.unit}
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
      cardTitle={t("dashboard.trackingCard.title")}
      cardDescription={t("dashboard.trackingCard.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
});

export default TrackingCard;
