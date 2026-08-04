"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { PosOrderCard } from "./pos-order-card";
import { QUEUE_STATUSES, type QueueStatusFilter } from "../lib/order-queue-filters";
import { getOrderStatusAccentClass, mapOrderStatusLabel } from "../lib/order-status-display";
import type { PosOrderDisplay } from "../types/pos.types";

interface PosOrderBoardProps {
  orders: PosOrderDisplay[];
  storeId: string;
  onUpdateStatus: (orderId: string, status: string) => void;
  highlightedStatus: QueueStatusFilter;
}

export function PosOrderBoard({
  orders,
  storeId,
  onUpdateStatus,
  highlightedStatus,
}: PosOrderBoardProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
      {QUEUE_STATUSES.map((status) => {
        const columnOrders = orders.filter((o) => o.status === status);
        const dimmed = highlightedStatus !== "ALL" && highlightedStatus !== status;
        return (
          <div
            key={status}
            className={cn(
              "flex min-w-[300px] max-w-sm flex-1 flex-col gap-3 transition-opacity",
              dimmed && "opacity-40"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2",
                getOrderStatusAccentClass(status)
              )}
            >
              <h3 className="text-sm font-semibold tracking-tight">
                {mapOrderStatusLabel(t, status)}
              </h3>
              <span className="bg-background flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                {columnOrders.length}
              </span>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto pb-4">
              {columnOrders.length === 0 ? (
                <div className="text-muted-foreground flex h-24 items-center justify-center rounded-xl border border-dashed text-sm">
                  {t("pos.kds.emptyDefault")}
                </div>
              ) : (
                columnOrders.map((order) => (
                  <PosOrderCard
                    key={order.id}
                    order={order}
                    storeId={storeId}
                    onUpdateStatus={onUpdateStatus}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
