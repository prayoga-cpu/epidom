"use client";

import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useI18n } from "@/components/lang/i18n-provider";
import { MOCK_ALERTS_FULL, MOCK_MATERIALS, MOCK_SUPPLIERS } from "@/mocks";
import { AlertType, AlertStatus, type Alert } from "@/types/entities";
import { AlertCircle } from "lucide-react";

interface AlertsTableProps {
  onViewDetails: (alert: Alert) => void;
  onCreateOrder: (alert: Alert) => void;
}

// Check if alert should be shown
function shouldShowAlert(alert: Alert): boolean {
  // Only show LOW_STOCK alerts
  if (alert.type !== AlertType.LOW_STOCK) return false;

  // Don't show resolved or snoozed alerts
  if (alert.status === AlertStatus.RESOLVED || alert.status === AlertStatus.SNOOZED) {
    return false;
  }

  return true;
}

export function AlertsTable({ onViewDetails, onCreateOrder }: AlertsTableProps) {
  const { t } = useI18n();

  // Filter active alerts
  const activeAlerts = useMemo(() => {
    return MOCK_ALERTS_FULL.filter(shouldShowAlert);
  }, []);

  // Group alerts by supplier
  const alertsBySupplier = useMemo(() => {
    const grouped = new Map<string, Array<{
      alert: Alert;
      material: any;
      currentStock: number;
      minStock: number;
      unit: string;
      stockPercentage: number;
    }>>();

    activeAlerts.forEach((alert) => {
      const material = alert.materialId
        ? MOCK_MATERIALS.find((m) => m.id === alert.materialId)
        : null;

      const primarySupplier =
        material?.materialSuppliers?.find((s) => s.isPreferred) ||
        material?.materialSuppliers?.[0];
      const supplierId = alert.supplierId ?? primarySupplier?.supplierId;
      const supplier = supplierId
        ? MOCK_SUPPLIERS.find((s) => s.id === supplierId)
        : primarySupplier?.supplier || null;

      const currentStock = alert.metadata?.currentStock ?? material?.currentStock ?? 0;
      const minStock = alert.metadata?.minStock ?? material?.minStock ?? 0;
      const unit = alert.metadata?.unit ?? material?.unit ?? "";
      const stockPercentage = minStock > 0 ? (currentStock / minStock) * 100 : 0;

      const supplierKey = supplier?.name || "Unknown Supplier";

      if (!grouped.has(supplierKey)) {
        grouped.set(supplierKey, []);
      }

      grouped.get(supplierKey)!.push({
        alert,
        material,
        currentStock,
        minStock,
        unit,
        stockPercentage,
      });
    });

    // Convert to array and add supplier info
    return Array.from(grouped.entries()).map(([supplierName, items]) => {
      const supplier = MOCK_SUPPLIERS.find((s) => s.name === supplierName);
      return {
        supplier: supplier || { name: supplierName, phone: "N/A" },
        items,
      };
    });
  }, [activeAlerts]);

  if (alertsBySupplier.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-primary/10 p-3 mb-4">
          <AlertCircle className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {t("alerts.noActiveAlerts")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("alerts.noActiveAlertsDescription")}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {alertsBySupplier.map((supplierGroup, idx) => (
        <div
          key={idx}
          className="bg-card relative z-0 rounded-xl border p-4 shadow-md transition-shadow hover:z-10 hover:shadow-lg sm:p-5"
        >
          {/* Supplier Header */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="from-primary/20 to-primary/10 text-primary bg-gradient-to-br text-lg font-bold">
                  {supplierGroup.supplier.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {supplierGroup.supplier.name}
                </p>
                {supplierGroup.supplier.phone && (
                  <a
                    href={`tel:${supplierGroup.supplier.phone}`}
                    className="text-primary hover:text-primary/80 block truncate text-sm underline underline-offset-2 transition-colors"
                  >
                    {supplierGroup.supplier.phone}
                  </a>
                )}
              </div>
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
                  {supplierGroup.items.map((item, i) => (
                    <li
                      key={i}
                      className="hover:bg-muted/30 flex items-center px-4 py-3 text-sm transition-colors"
                    >
                      <div className="w-2/6 font-medium">
                        {item.material?.name || "Unknown Material"}
                      </div>
                      <div className="w-2/6 px-3">
                        <Progress
                          value={Math.min(item.stockPercentage, 100)}
                          className="bg-muted [&>div]:bg-destructive h-2"
                        />
                      </div>
                      <div className="w-1/6 text-center font-semibold text-red-600 dark:text-red-400">
                        {item.currentStock} {item.unit}
                      </div>
                      <div className="w-1/6 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.minStock} {item.unit}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(supplierGroup.items[0].alert)}
            >
              {t("alerts.actions.viewDetails")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onCreateOrder(supplierGroup.items[0].alert)}
            >
              {t("alerts.actions.createOrder")}
            </Button>
          </div>

          {/* Date Footer */}
          <div className="mt-3 text-right">
            <span className="text-muted-foreground text-xs">
              {new Date(supplierGroup.items[0].alert.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
