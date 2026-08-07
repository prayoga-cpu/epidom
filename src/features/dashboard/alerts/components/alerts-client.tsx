"use client";

import { AlertsTable } from "./alerts-table";
import { UnpaidOrdersCard } from "./unpaid-orders-card";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  useAlerts,
  type Alert,
  type LowStockAlert,
  type UnpaidOrderAlert,
} from "@/features/dashboard/shared/hooks/use-alerts";

interface AlertsClientProps {
  initialAlerts: Alert[];
  storeId: string;
}

export function AlertsClient({ initialAlerts, storeId }: AlertsClientProps) {
  const { t } = useI18n();

  // Use initial data from Server Component with real-time updates
  const { data: alertsData } = useAlerts(storeId, {
    alerts: initialAlerts,
  });

  // Get alerts count from data (with real-time updates)
  const alertsCount = alertsData?.alerts?.length || initialAlerts.length;

  const allAlerts = alertsData?.alerts ?? initialAlerts;
  const lowStockAlerts = allAlerts.filter((a): a is LowStockAlert => a.type === "LOW_STOCK");
  const unpaidOrderAlerts = allAlerts.filter((a): a is UnpaidOrderAlert => a.type === "UNPAID_ORDER");

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t("alerts.title")}
            {alertsCount > 0 && (
              <span className="text-muted-foreground ml-2 text-xl font-bold sm:text-2xl md:text-3xl">
                ({alertsCount})
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">{t("alerts.description")}</p>
        </div>
      </div>

      {/* Content — signal only. Reordering/refilling stock now happens on the
          Stock tab of Management, which each alert row deep-links into. */}
      <div className="space-y-6">
        <UnpaidOrdersCard alerts={unpaidOrderAlerts} storeId={storeId} />
        {(lowStockAlerts.length > 0 || unpaidOrderAlerts.length === 0) && (
          <AlertsTable alerts={lowStockAlerts} storeId={storeId} />
        )}
      </div>
    </div>
  );
}
