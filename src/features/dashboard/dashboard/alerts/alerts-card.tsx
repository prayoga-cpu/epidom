"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useAlerts } from "@/features/dashboard/tracking/hooks/use-alerts";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import DashboardCard from "../_components/dashboard-card";

export default function AlertsCard() {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  const { data, isLoading } = useAlerts(storeId);

  // Get critical alerts (severity === "critical") and limit to 5
  const criticalAlerts =
    data?.alerts?.filter((alert) => alert.severity === "critical").slice(0, 5) || [];

  const cardContent = (
    <div className="h-full overflow-auto">
      {isLoading ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <Loader2 className="text-muted-foreground mb-3 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      ) : criticalAlerts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 rounded-full bg-green-100 p-3 dark:bg-green-900">
            <AlertCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-muted-foreground text-sm">
            {t("dashboard.alertsCard.noCriticalAlerts")}
          </p>
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
              return (
                <div
                  key={alert.id}
                  className="hover:bg-muted/30 flex items-center px-3 py-2.5 text-sm transition-colors"
                >
                  <div className="w-2/5 truncate font-medium">{alert.materialName}</div>
                  <div className="w-2/5 px-2">
                    <Progress
                      value={Math.min(alert.stockPercentage, 100)}
                      className="bg-muted [&>div]:bg-destructive h-2"
                    />
                  </div>
                  <div className="w-1/5 text-right font-semibold text-red-600 dark:text-red-400">
                    {Number(alert.currentStock)} {alert.unit}
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
    <Link href={`/store/${storeId}/alerts`}>
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
