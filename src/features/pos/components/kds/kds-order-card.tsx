"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KdsTimer } from "./kds-timer";
import { CheckCircle, ChefHat, Factory } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { PosOrderDisplay } from "../../types/pos.types";
import type { KdsDepartment } from "./kds-department";
import { itemDepartment } from "./kds-department";

interface KdsOrderCardProps {
  order: PosOrderDisplay;
  storeId: string;
  /** Which department's items this card shows/acts on — the Ready column
   * passes null to show every item, since a fully-ready order has nothing
   * left to filter by station. */
  department: KdsDepartment | null;
}

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PREPARING: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  READY: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  SERVED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function KdsOrderCard({ order, storeId, department }: KdsOrderCardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const cardItems = order.items.filter(
    (i) => i.status !== "CANCELLED" && (department === null || itemDepartment(i) === department)
  );

  const handleItemStatus = async (itemId: string, currentStatus: string) => {
    const next =
      currentStatus === "PENDING" ? "PREPARING" : currentStatus === "PREPARING" ? "READY" : null;
    if (!next) return;

    queryClient.setQueryData(["pos", "orders", storeId], (old: any[]) => {
      if (!old) return [];
      return old.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          items: o.items.map((i: any) => (i.id === itemId ? { ...i, status: next } : i)),
        };
      });
    });

    try {
      await apiClient.patch(`/stores/${storeId}/pos/orders/${order.id}/items/${itemId}`, {
        status: next,
      });
    } catch {
      toast.error(t("pos.kds.updateFailed"));
    }
  };

  // Marks only this card's (department-scoped) items ready — never the whole
  // order directly. The order itself auto-advances to READY server-side once
  // every item across every department is ready (see the item PATCH route),
  // so a mixed kitchen+bar order naturally waits for both stations.
  const handleMarkDepartmentComplete = async () => {
    const pendingIds = cardItems
      .filter((i) => i.status !== "READY" && i.status !== "SERVED")
      .map((i) => i.id);
    if (pendingIds.length === 0) return;

    queryClient.setQueryData(["pos", "orders", storeId], (old: any[]) => {
      if (!old) return [];
      return old.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          items: o.items.map((i: any) =>
            pendingIds.includes(i.id) ? { ...i, status: "READY" } : i
          ),
        };
      });
    });

    try {
      await Promise.all(
        pendingIds.map((itemId) =>
          apiClient.patch(`/stores/${storeId}/pos/orders/${order.id}/items/${itemId}`, {
            status: "READY",
          })
        )
      );
    } catch {
      toast.error(t("pos.kds.updateFailed"));
    }
  };

  const cardDone = cardItems.every((i) => i.status === "READY" || i.status === "SERVED");

  return (
    <div
      className={`bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-all ${
        order.status === "READY" ? "border-emerald-500/50 shadow-md shadow-emerald-500/10" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold">{order.orderNumber}</span>
            {order.tableLabel || order.tableNumber ? (
              <Badge variant="outline" className="text-xs">
                {order.tableLabel || order.tableNumber}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {t("pos.checkout.takeaway")}
              </Badge>
            )}
          </div>
          <KdsTimer startTime={order.createdAt} />
        </div>
        {order.customerName && (
          <span className="text-muted-foreground text-xs">{order.customerName}</span>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        {cardItems.map((item: any) => (
          <button
            key={item.id}
            onClick={() => handleItemStatus(item.id, item.status)}
            disabled={item.status === "READY" || item.status === "SERVED"}
            className={`group flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:opacity-80 disabled:cursor-default ${
              ITEM_STATUS_COLORS[item.status] ?? ITEM_STATUS_COLORS.PENDING
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.quantity}×</span>
                <span className="leading-tight font-medium">
                  {item.menuItem?.name ?? item.name}
                </span>
              </div>
              {item.selectedOptions?.length > 0 && (
                <span className="pl-6 text-xs opacity-80">
                  {item.selectedOptions.map((o: any) => o.optionName).join(", ")}
                </span>
              )}
              {item.notes && (
                <span className="pl-6 text-xs italic opacity-80">“{item.notes}”</span>
              )}
              {item.productionBatchId && (
                <span className="flex items-center gap-1 pl-6 text-xs opacity-80">
                  <Factory className="h-3 w-3" />
                  {t("pos.kds.fromProduction")}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold tracking-wide uppercase">
              {item.status === "PENDING"
                ? t("pos.kds.preparing")
                : item.status === "PREPARING"
                  ? t("pos.kds.tapToComplete")
                  : item.status === "READY"
                    ? t("pos.kds.checkReady")
                    : item.status}
            </span>
          </button>
        ))}
      </div>

      {order.notes && (
        <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span className="font-semibold">{t("common.notes")}: </span>
          {order.notes}
        </div>
      )}

      {!cardDone ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleMarkDepartmentComplete}
        >
          <ChefHat className="mr-2 h-4 w-4" />
          {t("pos.kds.markAllComplete")}
        </Button>
      ) : order.status !== "READY" ? (
        <div className="bg-muted text-muted-foreground flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium">
          {t("pos.kds.waitingOtherDepartment")}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-500/10 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          {t("pos.kds.readyToServe")}
        </div>
      )}
    </div>
  );
}
