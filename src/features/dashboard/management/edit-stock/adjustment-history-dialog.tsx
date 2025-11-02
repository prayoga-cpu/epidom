"use client";

import { useState, useMemo } from "react";
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
import { MovementType, type StockMovement } from "@/types/entities";
import { MOCK_STOCK_MOVEMENTS, MOCK_MATERIALS, MOCK_PRODUCTS } from "@/mocks";
import type { DateRange } from "react-day-picker";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  User,
  FileText,
  Hash,
} from "lucide-react";

interface AdjustmentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemType: "material" | "product";
}

export function AdjustmentHistoryDialog({
  open,
  onOpenChange,
  itemId,
  itemType,
}: AdjustmentHistoryDialogProps) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // TODO: Replace with TanStack Query
  // const { data: adjustments, isLoading } = useQuery({
  //   queryKey: ['adjustment-history', itemId, itemType, dateRange],
  //   queryFn: () => fetchAdjustmentHistory({
  //     itemId,
  //     itemType,
  //     dateFrom: dateRange?.from?.toISOString(),
  //     dateTo: dateRange?.to?.toISOString(),
  //   }),
  //   enabled: !!itemId,
  // });

  // Filter adjustments only (ADJUSTMENT_IN and ADJUSTMENT_OUT types)
  const filteredAdjustments = useMemo(() => {
    if (!itemId) return [];

    let filtered = MOCK_STOCK_MOVEMENTS.filter((mov) => {
      const matchesItem =
        itemType === "material" ? mov.materialId === itemId : mov.productId === itemId;

      // Only include adjustment movements
      const isAdjustment =
        mov.type === MovementType.ADJUSTMENT ||
        mov.reason?.includes("correction") ||
        mov.reason?.includes("adjustment");

      return matchesItem && isAdjustment;
    });

    // Apply date range filter
    if (dateRange?.from) {
      filtered = filtered.filter((mov) => new Date(mov.createdAt) >= dateRange.from!);
    }
    if (dateRange?.to) {
      filtered = filtered.filter((mov) => new Date(mov.createdAt) <= dateRange.to!);
    }

    // Sort by date descending (newest first)
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [itemId, itemType, dateRange]);

  // Calculate running balance after adjustments
  const adjustmentsWithBalance = useMemo(() => {
    let runningBalance = 0;
    // Process in reverse to calculate from oldest to newest
    const reversed = [...filteredAdjustments].reverse();

    const withBalance = reversed.map((adj) => {
      // Determine if it's an increase or decrease
      // For adjustments, positive quantity = increase, could also check reason
      const isIncrease = adj.quantity > 0;
      runningBalance += isIncrease ? adj.quantity : -adj.quantity;

      return {
        ...adj,
        runningBalance,
        isIncrease,
      };
    });

    // Reverse back to newest first
    return withBalance.reverse();
  }, [filteredAdjustments]);

  // Get item info
  const itemInfo = useMemo(() => {
    if (!itemId) return null;
    if (itemType === "material") {
      return MOCK_MATERIALS.find((m) => m.id === itemId);
    } else {
      return MOCK_PRODUCTS.find((p) => p.id === itemId);
    }
  }, [itemId, itemType]);

  // Export data
  const exportData = adjustmentsWithBalance.map((adj) => ({
    [t("common.date")]: formatDateTime(adj.createdAt),
    [t("common.type")]: adj.isIncrease ? t("management.editStock.increase") + " (+)" : t("management.editStock.decrease") + " (-)",
    [t("management.editStock.quantity")]: `${adj.isIncrease ? "+" : "-"}${Math.abs(adj.quantity)}`,
    [t("management.editStock.unit")]: adj.unit,
    [t("management.editStock.reason")]: adj.reason,
    [t("management.editStock.runningBalance")]: adj.runningBalance,
    [t("common.user")]: adj.userName,
    [t("common.reference")]: adj.referenceId || "-",
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
          {itemInfo && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Package className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="font-medium">{itemInfo.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {itemInfo.sku && `${t("common.sku")}: ${itemInfo.sku} • `}{t("management.editStock.unit")}: {itemInfo.unit}
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

            {adjustmentsWithBalance.length === 0 ? (
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
                    className="group relative rounded-lg border p-4 transition-colors hover:border-primary/50"
                  >
                    {/* Timeline connector */}
                    {index < adjustmentsWithBalance.length - 1 && (
                      <div className="absolute left-8 top-full h-3 w-px bg-border" />
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
                            <p className="text-muted-foreground mt-1 text-sm">{adj.reason}</p>
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
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDateTime(adj.createdAt)}</span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>{adj.userName}</span>
                          </div>

                          {adj.referenceId && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Hash className="h-3.5 w-3.5" />
                              <span>{t("common.reference")}: {adj.referenceId}</span>
                            </div>
                          )}

                          {adj.notes && (
                            <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
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
