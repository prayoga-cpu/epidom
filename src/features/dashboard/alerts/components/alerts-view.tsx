"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertsTable } from "./alerts-table";
import PlaceOrderDialog from "./place-order-dialog";
import { OrdersView } from "./orders-view";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useAlertsCount } from "../hooks/use-alerts-count";
import { type Alert } from "@/features/dashboard/tracking/hooks/use-alerts";

export function AlertsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOrders = searchParams.get("view") === "orders";
  const { t } = useI18n();
  const alertsCount = useAlertsCount();

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

  return (
    <>
      <Card className="min-h-[calc(100vh-150px)] border-0 bg-transparent shadow-none">
        <CardHeader className="flex flex-col justify-between gap-3 px-0 py-4 sm:flex-row sm:items-center sm:px-1">
          <CardTitle className="flex items-center gap-2 text-xl font-bold md:text-2xl">
            <span>{isOrders ? t("alerts.ordersToPlace") : t("alerts.title")}</span>
            {!isOrders && alertsCount > 0 && (
              <span className="text-muted-foreground text-lg font-bold md:text-xl">
                ({alertsCount})
              </span>
            )}
          </CardTitle>
          <Button
            size="sm"
            className="self-start rounded-full shadow-md transition-all hover:shadow-lg sm:self-center"
            aria-pressed={isOrders}
            onClick={handleToggle}
          >
            {isOrders ? t("actions.backToAlerts") : t("actions.ordersToPlace")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isOrders ? <OrdersView /> : <AlertsTable onCreateOrder={handleCreateOrder} />}
        </CardContent>
      </Card>

      {/* Place Order Dialog */}
      <PlaceOrderDialog
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        alert={selectedAlert}
      />
    </>
  );
}
