"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertsTable } from "./alerts-table";
import { PlaceOrderDialog } from "./place-order-dialog";
import { OrdersView } from "./orders-view";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useAlerts, type Alert } from "@/features/dashboard/tracking/hooks/use-alerts";

interface AlertsClientProps {
  initialAlerts: Alert[];
  storeId: string;
}

export function AlertsClient({ initialAlerts, storeId }: AlertsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOrders = searchParams.get("view") === "orders";
  const { t } = useI18n();

  // Use initial data from Server Component with real-time updates
  const { data: alertsData } = useAlerts(storeId, {
    alerts: initialAlerts,
  });

  // Get alerts count from data (with real-time updates)
  const alertsCount = alertsData?.alerts?.length || initialAlerts.length;

  // Dialog states
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);

  const handleToggle = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (isOrders) {
      params.delete("view");
    } else {
      params.set("view", "orders");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [isOrders, pathname, router, searchParams]);

  // Handle create order from alert
  const handleCreateOrder = (alert: Alert) => {
    setSelectedAlert(alert);
    setIsOrderDialogOpen(true);
  };

  // Get title and description based on current view
  const pageTitle = isOrders ? t("alerts.ordersToPlace") : t("alerts.title");
  const pageDescription = isOrders
    ? t("alerts.ordersToPlaceDescription")
    : t("alerts.description");

  return (
    <>
      <div className="min-h-[calc(100vh-150px)] space-y-4">
        {/* Header - Consistent with Tracking and Dashboard */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                {pageTitle}
                {!isOrders && alertsCount > 0 && (
                  <span className="text-muted-foreground ml-2 text-xl font-bold sm:text-2xl md:text-3xl">
                    ({alertsCount})
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground text-sm">{pageDescription}</p>
            </div>
            <Button
              size="sm"
              className="rounded-full shadow-md transition-all hover:shadow-lg"
              aria-pressed={isOrders}
              onClick={handleToggle}
            >
              {isOrders ? t("actions.backToAlerts") : t("actions.ordersToPlace")}
            </Button>
          </div>
        </div>

        {/* Content */}
        {isOrders ? (
          <OrdersView />
        ) : (
          <AlertsTable
            alerts={alertsData?.alerts ?? initialAlerts}
            onCreateOrder={handleCreateOrder}
          />
        )}
      </div>

      {/* Place Order Dialog */}
      <PlaceOrderDialog
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        alert={selectedAlert}
      />
    </>
  );
}


