"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ExportButton } from "@/components/ui/export-button";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatDateTime } from "@/lib/utils/formatting";
import { MovementType } from "@prisma/client";
import type { DateRange } from "react-day-picker";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  User,
  FileText,
  Hash,
  Loader2,
} from "lucide-react";
import { useStockMovements } from "./hooks/use-stock-movements";

interface AdjustmentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemType: "material" | "product";
}

type ItemInfo = {
  name: string;
  sku?: string;
  unit: string;
  currentStock?: number;
};

export function AdjustmentHistoryDialog({
  open,
  onOpenChange,
  itemId,
  itemType,
}: AdjustmentHistoryDialogProps) {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string;
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Fetch stock movements from API
  const { data, isLoading } = useStockMovements(storeId, {
    materialId: itemType === "material" ? itemId || undefined : undefined,
    productId: itemType === "product" ? itemId || undefined : undefined,
    itemType,
    dateFrom: dateRange?.from?.toISOString(),
    dateTo: dateRange?.to?.toISOString(),
  });

  const movements = data?.movements || [];

  // Filter adjustments only (ADJUSTMENT types)
  const filteredAdjustments = useMemo(() => {
    return movements.filter((mov) => {
      // Only show adjustment movements
      return mov.type === MovementType.ADJUSTMENT;
    });
  }, [movements]);

  // Calculate running balance after adjustments
  const adjustmentsWithBalance = useMemo(() => {
    if (filteredAdjustments.length === 0) return [];

    let runningBalance = 0;
    // Process in reverse to calculate from oldest to newest
    const reversed = [...filteredAdjustments].reverse();

    const withBalance = reversed.map((adj) => {
      // Determine if it's an increase or decrease based on quantity
      const quantityNum = Number(adj.quantity);
      const isIncrease = quantityNum > 0;
      runningBalance += quantityNum;

      return {
        ...adj,
        runningBalance,
        isIncrease,
        quantity: Math.abs(quantityNum),
      };
    });

    // Reverse back to newest first
    return withBalance.reverse();
  }, [filteredAdjustments]);

  // Get item info from the first movement's material/product
  const itemInfo = useMemo<ItemInfo | null>(() => {
    if (!itemId || movements.length === 0) return null;

    const firstMovement = movements[0];
    const item = itemType === "material" ? firstMovement.material : firstMovement.product;

    if (!item) return null;

    return {
      name: item.name,
      sku: item.sku || undefined,
      unit: item.unit,
      currentStock: Number(firstMovement.balanceAfter),
    };
  }, [itemId, itemType, movements]);

  // Export data
  const exportData = adjustmentsWithBalance.map((adj) => ({
    [t("common.date")]: formatDateTime(adj.createdAt),
    [t("common.type")]: adj.type,
    [t("management.editStock.quantity")]: `${adj.isIncrease ? "+" : "-"}${adj.quantity}`,
    [t("management.editStock.unit")]: adj.unit,
    [t("management.editStock.runningBalance")]: adj.runningBalance,
    [t("management.editStock.reason")]: (adj as any).reason || "-",
    [t("common.reference")]: adj.productionBatchId
      ? `Batch: ${(adj as any).productionBatch?.batchNumber || adj.productionBatchId}`
      : adj.orderId
        ? `Order: ${(adj as any).order?.orderNumber || adj.orderId}`
        : (adj as any).referenceId || "-",
    [t("common.notes")]: adj.notes || "-",
  }));

  if (!itemId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("management.editStock.adjustmentHistoryDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("management.editStock.adjustmentHistoryDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          {itemInfo && itemInfo !== null && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Package className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="font-medium">{itemInfo.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {itemInfo.sku && `${t("common.sku")}: ${itemInfo.sku} • `}
                    {t("management.editStock.unit")}: {itemInfo.unit}
                    {itemInfo.currentStock !== undefined &&
                      ` • ${t("management.editStock.currentStock")}: ${itemInfo.currentStock} ${itemInfo.unit}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Export */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <ExportButton
              data={exportData}
              filename={`adjustment-history-${itemId}`}
              variant="outline"
              size="sm"
            />
          </div>

          <Separator />

          {/* Statistics */}
          {adjustmentsWithBalance.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("management.editStock.totalAdjustments")}
                </p>
                <p className="text-2xl font-bold">{adjustmentsWithBalance.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("management.editStock.increases")}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {adjustmentsWithBalance.filter((a) => a.isIncrease).length}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("management.editStock.decreases")}
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {adjustmentsWithBalance.filter((a) => !a.isIncrease).length}
                </p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              {t("management.editStock.adjustmentTimeline")}
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              </div>
            ) : adjustmentsWithBalance.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">
                  {t("management.editStock.noAdjustmentHistory")}
                </p>
                {dateRange && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setDateRange(undefined)}
                    className="mt-2"
                  >
                    {t("management.editStock.clearFilters")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {adjustmentsWithBalance.map((adj, index) => (
                  <div
                    key={`${adj.id}-${index}`}
                    className="group hover:border-primary/50 relative rounded-lg border p-4 transition-colors"
                  >
                    {/* Timeline connector */}
                    {index < adjustmentsWithBalance.length - 1 && (
                      <div className="bg-border absolute top-full left-8 h-3 w-px" />
                    )}

                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`rounded-full p-2 ${
                          adj.isIncrease
                            ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                            : "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300"
                        }`}
                      >
                        {adj.isIncrease ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={adj.isIncrease ? "default" : "secondary"}
                                className={
                                  adj.isIncrease
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                }
                              >
                                {adj.isIncrease
                                  ? t("management.editStock.increase")
                                  : t("management.editStock.decrease")}
                              </Badge>
                              <span className="text-lg font-semibold">
                                {adj.isIncrease ? "+" : "-"}
                                {Math.abs(adj.quantity)} {adj.unit}
                              </span>
                            </div>
                            {(adj as any).reason && (
                              <p className="text-muted-foreground mt-1 text-sm font-medium">
                                {t("management.editStock.reason")}: {(adj as any).reason}
                              </p>
                            )}
                            {adj.notes && (
                              <p className="text-muted-foreground mt-1 text-sm">{adj.notes}</p>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="text-muted-foreground text-xs">
                              {t("management.editStock.runningBalance")}
                            </p>
                            <p className="text-lg font-semibold">
                              {adj.runningBalance} {adj.unit}
                            </p>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <div className="text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDateTime(adj.createdAt)}</span>
                          </div>

                          <div className="text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline">{adj.type}</Badge>
                          </div>

                          {((adj as any).referenceId || adj.productionBatchId || adj.orderId) && (
                            <div className="text-muted-foreground flex items-center gap-2">
                              <Hash className="h-3.5 w-3.5" />
                              <span>
                                {t("common.reference")}:{" "}
                                {(adj as any).referenceId ||
                                  (adj.productionBatchId
                                    ? `Batch ${adj.productionBatchId}`
                                    : adj.orderId
                                      ? `Order ${adj.orderId}`
                                      : "-")}
                              </span>
                            </div>
                          )}

                          {adj.notes && (
                            <div className="text-muted-foreground flex items-center gap-2 sm:col-span-2">
                              <FileText className="h-3.5 w-3.5" />
                              <span>{adj.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
