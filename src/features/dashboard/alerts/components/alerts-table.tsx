"use client";

import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { type Alert } from "@/features/dashboard/tracking/hooks/use-alerts";
import { AlertCircle, ShoppingCart, Package2 } from "lucide-react";
import { BulkOrderDialog } from "./bulk-order-dialog";
import { formatDate } from "@/lib/utils/format-date";

interface AlertsTableProps {
  alerts: Alert[];
  onViewDetails?: (alert: Alert) => void;
  onCreateOrder: (alert: Alert) => void;
}

export function AlertsTable({ alerts, onViewDetails, onCreateOrder }: AlertsTableProps) {
  const { t } = useI18n();

  // Bulk order dialog state
  const [isBulkOrderOpen, setIsBulkOrderOpen] = useState(false);
  const [selectedSupplierGroup, setSelectedSupplierGroup] = useState<{
    supplier: { id: string; name: string };
    items: Alert[];
  } | null>(null);

  // Handle bulk order
  const handleBulkOrder = (supplierGroup: {
    supplier: { id: string; name: string };
    items: Alert[];
  }) => {
    setSelectedSupplierGroup(supplierGroup);
    setIsBulkOrderOpen(true);
  };

  // Group alerts by supplier
  const alertsBySupplier = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];

    const grouped = new Map<string, Array<Alert>>();
    const noSupplierAlerts: Alert[] = [];

    alerts.forEach((alert) => {
      // Check if alert has suppliers
      if (!alert.suppliers || alert.suppliers.length === 0) {
        noSupplierAlerts.push(alert);
        return;
      }

      // Group by preferred supplier or first supplier
      const preferredSupplier = alert.suppliers.find((s) => s.isPreferred);
      const supplier = preferredSupplier || alert.suppliers[0];

      const supplierKey = supplier.name;

      if (!grouped.has(supplierKey)) {
        grouped.set(supplierKey, []);
      }

      grouped.get(supplierKey)!.push(alert);
    });

    // Convert to array and add supplier info
    const result = Array.from(grouped.entries()).map(([supplierName, items]) => {
      const firstItem = items[0];
      const supplier =
        firstItem.suppliers.find((s) => s.name === supplierName) || firstItem.suppliers[0];

      return {
        supplier: {
          id: supplier.id,
          name: supplierName,
        },
        items,
      };
    });

    // Add materials without suppliers at the end
    if (noSupplierAlerts.length > 0) {
      result.push({
        supplier: {
          id: "no-supplier",
          name: t("alerts.noSupplierAssigned"),
        },
        items: noSupplierAlerts,
      });
    }

    return result;
  }, [alerts, t]);


<<<<<<< HEAD
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-destructive/10 mb-4 rounded-full p-3">
            <AlertCircle className="text-destructive h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{t("common.error")}</h3>
          <p className="text-muted-foreground text-sm">
            {error.message || t("alerts.errorLoading")}
          </p>
        </CardContent>
      </Card>
    );
  }
=======
>>>>>>> dev

  if (alertsBySupplier.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <AlertCircle className="text-primary h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{t("alerts.noActiveAlerts")}</h3>
          <p className="text-muted-foreground text-sm">{t("alerts.noActiveAlertsDescription")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <section className="space-y-6">
        {alertsBySupplier.map((supplierGroup, idx) => (
          <div
            key={idx}
            className="bg-card relative z-0 rounded-xl border p-4 shadow-md transition-shadow hover:z-10 hover:shadow-lg sm:p-5"
          >
            {/* Supplier Header */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <p className="truncate text-base font-semibold">{supplierGroup.supplier.name}</p>
              </div>
              <Badge variant="destructive">
                {t("alerts.table.lowStock")} ({supplierGroup.items.length})
              </Badge>
            </div>

            {/* Materials Table with Progress Bars */}
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <div className="min-w-[720px] px-4 sm:px-0">
                <div className="overflow-hidden rounded-lg border shadow-sm">
                  <div className="from-foreground/90 to-foreground/80 text-background flex bg-gradient-to-r px-4 py-3 text-xs font-bold">
                    <div className="w-2/6">{t("alerts.table.material")}</div>
                    <div className="w-2/6 text-center">{t("alerts.table.stockLevel")}</div>
                    <div className="w-1/6 text-center">{t("alerts.table.currentStock")}</div>
                    <div className="w-1/6 text-center">{t("alerts.table.minStock")}</div>
                  </div>
                  <ul className="divide-border divide-y">
                    {supplierGroup.items.map((alert) => (
                      <li
                        key={alert.id}
                        className="hover:bg-muted/30 flex items-center px-4 py-3 text-sm transition-colors"
                      >
                        <div className="w-2/6 font-medium">
                          {alert.materialName}
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({alert.materialSku})
                          </span>
                        </div>
                        <div className="w-2/6 px-3">
                          <Progress
                            value={Math.min(alert.stockPercentage, 100)}
                            className="bg-muted h-2 [&>div]:bg-red-600"
                          />
                        </div>
                        <div className="w-1/6 text-center font-semibold text-red-600 dark:text-red-400">
                          {Number(alert.currentStock)} {alert.unit}
                        </div>
                        <div className="w-1/6 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {Number(alert.minStock)} {alert.unit}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {supplierGroup.supplier.id === "no-supplier" ? (
                <Button variant="outline" size="sm" disabled>
                  {t("alerts.actions.noSupplier")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkOrder(supplierGroup)}
                    className="gap-2"
                  >
                    <Package2 className="h-4 w-4" />
                    Bulk Order
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onCreateOrder(supplierGroup.items[0])}
                    className="gap-2"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {t("alerts.actions.createOrder")}
                  </Button>
                </>
              )}
            </div>

            {/* Date Footer */}
            <div className="mt-3 text-right">
              <span className="text-muted-foreground text-xs">
                {formatDate(supplierGroup.items[0].createdAt)}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Bulk Order Dialog */}
      {selectedSupplierGroup && (
        <BulkOrderDialog
          open={isBulkOrderOpen}
          onOpenChange={setIsBulkOrderOpen}
          alerts={selectedSupplierGroup.items}
          supplierName={selectedSupplierGroup.supplier.name}
          supplierId={selectedSupplierGroup.supplier.id}
        />
      )}
    </>
  );
}
