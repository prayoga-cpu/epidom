"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/lang/i18n-provider";
import { MOCK_MATERIALS } from "@/mocks";
import { ArrowRight, Package } from "lucide-react";
import DashboardCard from "../_components/dashboard-card";

export default function TrackingCard() {
  const { t } = useI18n();

  // Get materials with stock data, sorted by stock percentage
  const stockLevels = useMemo(() => {
    return MOCK_MATERIALS.map((material) => {
      const stockPercentage =
        material.maxStock > 0 ? (material.currentStock / material.maxStock) * 100 : 0;
      return {
        ...material,
        stockPercentage,
      };
    })
      .sort((a, b) => a.stockPercentage - b.stockPercentage) // Low stock first
      .slice(0, 5); // Show max 5 items
  }, []);

  const cardContent = (
    <div className="h-full overflow-auto">
      {stockLevels.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <Package className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground text-sm">{t("dashboard.trackingCard.noStockData")}</p>
        </div>
      ) : (
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
      )}
    </div>
  );

  const cardOther = (
    <Link href="/tracking">
      <Button variant="ghost" size="sm" className="h-8 gap-1">
        {t("dashboard.trackingCard.viewAll")}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  return (
    <DashboardCard
      cardTitle={t("dashboard.trackingCard.title")}
      cardDescription={t("dashboard.trackingCard.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
}
