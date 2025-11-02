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
import { formatDateTime, formatDate } from "@/lib/utils/formatting";
import { MovementType, type StockMovement } from "@/types/entities";
import { MOCK_STOCK_MOVEMENTS, MOCK_MATERIALS } from "@/mocks";
import type { DateRange } from "react-day-picker";
import { TrendingUp, TrendingDown, Package, Calendar, User, ArrowRight } from "lucide-react";

interface StockHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemType: "material" | "product";
}

// Helper function to get movement type color
function getMovementTypeColor(type: MovementType): string {
  switch (type) {
    case MovementType.IN:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case MovementType.OUT:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case MovementType.ADJUSTMENT:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case MovementType.PRODUCTION:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case MovementType.WASTE:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case MovementType.RETURN:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
}

export function StockHistoryDialog({
  open,
  onOpenChange,
  itemId,
  itemType,
}: StockHistoryDialogProps) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // TODO: Replace with TanStack Query
  // const { data: movements, isLoading } = useQuery({
  //   queryKey: ['stock-history', itemId, itemType, dateRange],
  //   queryFn: () => fetchStockHistory({
  //     itemId,
  //     itemType,
  //     dateFrom: dateRange?.from?.toISOString(),
  //     dateTo: dateRange?.to?.toISOString(),
  //   }),
  //   enabled: !!itemId,
  // });

  // Filter movements by itemId and date range
  const filteredMovements = useMemo(() => {
    if (!itemId) return [];

    let filtered = MOCK_STOCK_MOVEMENTS.filter((mov) => {
      const matchesItem =
        itemType === "material" ? mov.materialId === itemId : mov.productId === itemId;
      return matchesItem;
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

  // Calculate running balance
  const movementsWithBalance = useMemo(() => {
    let runningBalance = 0;
    // Process in reverse to calculate from oldest to newest
    const reversed = [...filteredMovements].reverse();

    const withBalance = reversed.map((mov) => {
      if (mov.type === MovementType.IN || mov.type === MovementType.RETURN) {
        runningBalance += mov.quantity;
      } else if (
        mov.type === MovementType.OUT ||
        mov.type === MovementType.PRODUCTION ||
        mov.type === MovementType.WASTE
      ) {
        runningBalance -= mov.quantity;
      } else if (mov.type === MovementType.ADJUSTMENT) {
        // Adjustment can be positive or negative
        runningBalance += mov.quantity;
      }

      return {
        ...mov,
        runningBalance,
      };
    });

    // Reverse back to newest first
    return withBalance.reverse();
  }, [filteredMovements]);

  // Get item info
  const itemInfo = useMemo(() => {
    if (!itemId || itemType !== "material") return null;
    return MOCK_MATERIALS.find((m) => m.id === itemId);
  }, [itemId, itemType]);

  // Export data
  const exportData = movementsWithBalance.map((mov) => ({
    Date: formatDateTime(mov.createdAt),
    Type: mov.type,
    Quantity: `${mov.type === MovementType.IN || mov.type === MovementType.RETURN ? "+" : "-"}${mov.quantity}`,
    Unit: mov.unit,
    Reason: mov.reason,
    "Running Balance": mov.runningBalance,
    User: mov.userName,
    Reference: mov.referenceId || "-",
  }));

  if (!itemId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("tracking.dialogs.stockHistory.title")}</DialogTitle>
          <DialogDescription>{t("tracking.dialogs.stockHistory.description")}</DialogDescription>
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
                    SKU: {itemInfo.sku} • Unit: {itemInfo.unit}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Export */}
          <div className="flex items-center justify-between gap-4">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <ExportButton
              data={exportData}
              filename={`stock-history-${itemId}`}
              variant="outline"
              size="sm"
            />
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t("tracking.movementTimeline")}</h3>

            {movementsWithBalance.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">{t("tracking.noHistory")}</p>
                {dateRange && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setDateRange(undefined)}
                    className="mt-2"
                  >
                    {t("tracking.clearFilters")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {movementsWithBalance.map((movement, index) => (
                  <div key={movement.id} className="relative">
                    {/* Timeline line */}
                    {index < movementsWithBalance.length - 1 && (
                      <div className="bg-border absolute top-8 bottom-[-16px] left-[15px] w-[2px]" />
                    )}

                    {/* Movement card */}
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className="bg-background border-border relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2">
                        {movement.type === MovementType.IN ||
                        movement.type === MovementType.RETURN ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="bg-card flex-1 rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* Header */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={getMovementTypeColor(movement.type)}
                              >
                                {t(`tracking.movements.${movement.type.toLowerCase()}`)}
                              </Badge>
                              <span className="text-muted-foreground text-sm">
                                {formatDateTime(movement.createdAt)}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-muted-foreground text-sm">
                                  {t("tracking.quantity")}
                                </p>
                                <p className="text-sm font-medium">
                                  <span
                                    className={
                                      movement.type === MovementType.IN ||
                                      movement.type === MovementType.RETURN
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {movement.type === MovementType.IN ||
                                    movement.type === MovementType.RETURN
                                      ? "+"
                                      : "-"}
                                    {movement.quantity} {movement.unit}
                                  </span>
                                  <ArrowRight className="mx-2 inline h-4 w-4" />
                                  <span className="text-muted-foreground">
                                    {t("tracking.runningBalance")}: {movement.runningBalance}{" "}
                                    {movement.unit}
                                  </span>
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-sm">
                                  {t("tracking.reason")}
                                </p>
                                <p className="text-sm">{movement.reason}</p>
                              </div>
                            </div>

                            {/* Additional Info */}
                            <div className="text-muted-foreground flex items-center gap-4 text-xs">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {movement.userName}
                              </span>
                              {movement.referenceId && <span>Ref: {movement.referenceId}</span>}
                            </div>

                            {movement.notes && (
                              <div className="bg-muted/50 mt-2 rounded-md p-2">
                                <p className="text-muted-foreground text-xs">{movement.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {movementsWithBalance.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {(t("tracking.showingMovements") || "Showing {count} movements").replace(
                    "{count}",
                    movementsWithBalance.length.toString()
                  )}
                </span>
                <span className="font-medium">
                  {t("tracking.currentStock")}: {movementsWithBalance[0]?.runningBalance || 0}{" "}
                  {movementsWithBalance[0]?.unit || ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
