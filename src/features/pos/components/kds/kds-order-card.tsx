"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KdsTimer } from "./kds-timer";
import { CheckCircle, ChefHat } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { PosOrderDisplay } from "../../types/pos.types";

interface KdsOrderCardProps {
  order: PosOrderDisplay;
  storeId: string;
}

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PREPARING: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  READY: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  SERVED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function KdsOrderCard({ order, storeId }: KdsOrderCardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const handleItemStatus = async (itemId: string, currentStatus: string) => {
    const next =
      currentStatus === "PENDING" ? "PREPARING"
      : currentStatus === "PREPARING" ? "READY"
      : null;
    if (!next) return;

    queryClient.setQueryData(["pos", "orders", storeId], (old: any[]) => {
      if (!old) return [];
      return old.map((o) => {
        if (o.id !== order.id) return o;
        return { ...o, items: o.items.map((i: any) => i.id === itemId ? { ...i, status: next } : i) };
      });
    });

    try {
      await apiClient.patch(`/stores/${storeId}/pos/orders/${order.id}/items/${itemId}`, { status: next });
    } catch {
      toast.error(t("pos.kds.updateFailed"));
    }
  };

  const handleOrderReady = async () => {
    queryClient.setQueryData(["pos", "orders", storeId], (old: any[]) => {
      if (!old) return [];
      return old.map((o) => o.id === order.id ? { ...o, status: "READY" } : o);
    });
    try {
      await apiClient.patch(`/stores/${storeId}/pos/orders/${order.id}`, { status: "READY" });
      toast.success(`${order.orderNumber} ${t("pos.kds.readyToServe").toLowerCase()}`);
    } catch {
      toast.error(t("pos.kds.updateFailed"));
    }
  };

  const allItemsDone = order.items.every(
    (i) => i.status === "READY" || i.status === "SERVED" || i.status === "CANCELLED"
  );

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all ${
        order.status === "READY" ? "border-emerald-500/50 shadow-emerald-500/10 shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold">{order.orderNumber}</span>
            {order.tableLabel || order.tableNumber ? (
              <Badge variant="outline" className="text-xs">{order.tableLabel || order.tableNumber}</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">{t("pos.checkout.takeaway")}</Badge>
            )}
          </div>
          <KdsTimer startTime={order.createdAt} />
        </div>
        {order.customerName && (
          <span className="text-xs text-muted-foreground">{order.customerName}</span>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        {order.items
          .filter((i) => i.status !== "CANCELLED")
          .map((item: any) => (
            <button
              key={item.id}
              onClick={() => handleItemStatus(item.id, item.status)}
              disabled={item.status === "READY" || item.status === "SERVED"}
              className={`group flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:opacity-80 disabled:cursor-default ${
                ITEM_STATUS_COLORS[item.status] ?? ITEM_STATUS_COLORS.PENDING
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.quantity}×</span>
                <span className="font-medium leading-tight">{item.menuItem?.name ?? item.name}</span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide">
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

      {!allItemsDone ? (
        <Button size="sm" variant="outline" className="w-full" onClick={handleOrderReady}>
          <ChefHat className="mr-2 h-4 w-4" />
          {t("pos.kds.markAllComplete")}
        </Button>
      ) : order.status !== "READY" ? (
        <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleOrderReady}>
          <CheckCircle className="mr-2 h-4 w-4" />
          {t("pos.kds.orderReadyTitle")}
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-500/10 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          {t("pos.kds.readyToServe")}
        </div>
      )}
    </div>
  );
}
