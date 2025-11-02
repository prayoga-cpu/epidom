"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/lang/i18n-provider";
import { MOCK_ALERTS_FULL, MOCK_MATERIALS } from "@/mocks";
import { AlertType, AlertStatus, AlertPriority } from "@/types/entities";
import { ArrowRight, AlertCircle } from "lucide-react";
import DashboardCard from "../_components/dashboard-card";

export default function AlertsCard() {
  const { t } = useI18n();

  // Filter critical and high priority alerts only
  const criticalAlerts = useMemo(() => {
    return MOCK_ALERTS_FULL.filter(
      (alert) =>
        alert.type === AlertType.LOW_STOCK &&
        alert.status === AlertStatus.ACTIVE &&
        (alert.priority === AlertPriority.CRITICAL || alert.priority === AlertPriority.HIGH)
    ).slice(0, 5); // Show max 5 alerts
  }, []);

  const cardContent = (
    <div className="h-full overflow-auto">
      {criticalAlerts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 rounded-full bg-green-100 p-3 dark:bg-green-900">
            <AlertCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-muted-foreground text-sm">{t("dashboard.alertsCard.noCriticalAlerts")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {/* Table Header */}
          <div className="from-foreground/90 to-foreground/80 text-background flex bg-gradient-to-r px-3 py-2 text-xs font-bold">
            <div className="w-2/5">{t("dashboard.alertsCard.material")}</div>
            <div className="w-2/5 text-center">{t("dashboard.alertsCard.stockLevel")}</div>
            <div className="w-1/5 text-right">{t("dashboard.alertsCard.current")}</div>
          </div>

          {/* Table Body */}
          <div className="divide-border divide-y">
            {criticalAlerts.map((alert) => {
              const material = alert.materialId
                ? MOCK_MATERIALS.find((m) => m.id === alert.materialId)
                : null;
              const currentStock = alert.metadata?.currentStock ?? material?.currentStock ?? 0;
              const minStock = alert.metadata?.minStock ?? material?.minStock ?? 0;
              const unit = alert.metadata?.unit ?? material?.unit ?? "";
              const stockPercentage = minStock > 0 ? (currentStock / minStock) * 100 : 0;

              return (
                <div
                  key={alert.id}
                  className="hover:bg-muted/30 flex items-center px-3 py-2.5 text-sm transition-colors"
                >
                  <div className="w-2/5 truncate font-medium">
                    {material?.name || t("dashboard.alertsCard.unknownMaterial")}
                  </div>
                  <div className="w-2/5 px-2">
                    <Progress
                      value={Math.min(stockPercentage, 100)}
                      className="bg-muted [&>div]:bg-destructive h-2"
                    />
                  </div>
                  <div className="w-1/5 text-right font-semibold text-red-600 dark:text-red-400">
                    {currentStock} {unit}
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
    <Link href="/alerts">
      <Button variant="ghost" size="sm" className="h-8 gap-1">
        {t("dashboard.alertsCard.viewAll")}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  return (
    <DashboardCard
      cardClassName="col-span-3"
      cardTitle={t("dashboard.alertsCard.title")}
      cardDescription={t("dashboard.alertsCard.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
}
