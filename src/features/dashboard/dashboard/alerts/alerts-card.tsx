"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/lang/i18n-provider";
import { Alert, useAlerts } from "@/features/dashboard/tracking/hooks/use-alerts";
<<<<<<< HEAD
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { DashboardCard } from "../components/dashboard-card";
=======
import { ArrowRight, AlertCircle } from "lucide-react";
import { DashboardCard } from "../components/dashboard-card";
import { LottieLoader } from "@/components/ui/lottie-loader";
>>>>>>> dev

interface AlertsCardProps {
  initialAlerts: Alert[];
  storeId: string;
}

export function AlertsCard({ initialAlerts, storeId }: AlertsCardProps) {
  const { t } = useI18n();

  // Use the dedicated alerts hook with initial data from server
  // This uses the optimized DB query (prisma.$queryRaw) instead of client-side filtering
  const { data, isLoading, error } = useAlerts(storeId, { alerts: initialAlerts });

  const alerts = data?.alerts || [];

  const cardContent = (
    <div className="flex min-h-[300px] flex-1 flex-col">
      {!storeId ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <LottieLoader size="md" className="mb-3" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <AlertCircle className="text-muted-foreground mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            {t("messages.errorLoadingAlerts") || "Failed to load alerts"}
          </p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <AlertCircle className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground text-sm">
            {t("dashboard.alertsCard.noCriticalAlerts")}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
          {/* Table Header */}
          <div className="from-foreground/90 to-foreground/80 text-background flex shrink-0 bg-gradient-to-r px-3 py-2 text-xs font-bold">
            <div className="w-2/5">{t("dashboard.alertsCard.material")}</div>
            <div className="w-2/5 text-center">{t("dashboard.alertsCard.stockLevel")}</div>
            <div className="w-1/5 text-right">{t("dashboard.alertsCard.current")}</div>
          </div>

          {/* Table Body */}
          <div className="divide-border flex-1 divide-y overflow-y-auto">
            {alerts.slice(0, 5).map((alert) => {
              return (
                <div
                  key={alert.id}
                  className="hover:bg-muted/30 flex items-center px-3 py-2.5 text-sm transition-colors"
                >
                  <div className="w-2/5 truncate font-medium">{alert.materialName}</div>
                  <div className="w-2/5 px-2">
                    <Progress
                      value={Math.min(alert.stockPercentage, 100)}
                      className={`[&>div]:bg-destructive bg-muted h-2`}
                    />
                  </div>
                  <div className="w-1/5 text-right font-semibold text-red-600 dark:text-red-400">
                    {alert.currentStock} {alert.unit}
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
      cardTitle={t("dashboard.alertsCard.title")}
      cardDescription={t("dashboard.alertsCard.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
}
