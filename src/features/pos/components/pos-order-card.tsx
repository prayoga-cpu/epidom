"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { formatDistanceToNow } from "date-fns";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import type { PosOrderDisplay } from "../types/pos.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { id, enUS, fr } from "date-fns/locale";
import { useOrderQueueActions } from "../hooks/use-order-queue-actions";
import { PosOrderPrimaryAction } from "./pos-order-primary-action";
import {
  getOrderSourceBadgeVariant,
  getOrderStatusAccentClass,
  getOrderStatusBadgeVariant,
  isAwaitingPayment,
  mapOrderStatusLabel,
  mapPaymentMethodLabel,
} from "../lib/order-status-display";

interface PosOrderCardProps {
  order: PosOrderDisplay;
  storeId: string;
  onUpdateStatus: (orderId: string, status: string) => void;
}

export function PosOrderCard({ order, storeId, onUpdateStatus }: PosOrderCardProps) {
  const { t, locale } = useI18n();
  // Order total is literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const { handleCancel, handleResume, confirmDialog } = useOrderQueueActions(
    order,
    storeId,
    onUpdateStatus
  );

  const dateLocaleMap = { en: enUS, id, fr };
  const dateLocale = dateLocaleMap[locale] ?? id;

  const timeAgo = formatDistanceToNow(new Date(order.createdAt), {
    addSuffix: true,
    locale: dateLocale,
  });

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-3 rounded-lg border p-4 shadow-sm",
        getOrderStatusAccentClass(order.status)
      )}
    >
      <div className="flex items-start justify-between border-b pb-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{order.orderNumber}</span>
          <span className="text-muted-foreground text-xs">{timeAgo}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Badge variant={getOrderStatusBadgeVariant(order.status)} className="w-full px-2 py-1">
            {mapOrderStatusLabel(t, order.status)}
          </Badge>
          <Badge variant={getOrderSourceBadgeVariant(order.source)} className="w-full">
            {order.source === "POS" ? t("pos.source.walkIn") : t("pos.source.online")}
          </Badge>
          <Badge variant="outline" className="w-full">
            {mapPaymentMethodLabel(t, order.paymentMethod)}
          </Badge>
          {isAwaitingPayment(order) && (
            <Badge variant="destructive" className="w-full">
              {t("pos.orderCard.unpaid")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("pos.orderCard.customer")}:</span>
          <span className="font-medium">{order.customerName}</span>
        </div>
        {(order.tableLabel || order.tableNumber) && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pos.orderCard.table")}:</span>
            <span className="font-medium">{order.tableLabel || order.tableNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("pos.orderCard.type")}:</span>
          <span className="font-medium">
            {order.orderType === "DINE_IN" ? t("pos.checkout.dineIn") : t("pos.checkout.takeaway")}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 border-t pt-3">
        <span className="text-muted-foreground text-xs font-semibold uppercase">
          {t("pos.orderCard.itemsLabel")} ({order.items.length})
        </span>
        <ul className="text-sm">
          {order.items.slice(0, 3).map((item, i) => (
            <li key={i} className="py-0.5">
              <span>
                {item.quantity}x {item.menuItem?.name || item.name}
              </span>
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <span className="text-muted-foreground block pl-4 text-xs">
                  {item.selectedOptions.map((o) => o.optionName).join(", ")}
                </span>
              )}
              {item.notes && (
                <span className="text-muted-foreground block pl-4 text-xs italic">
                  “{item.notes}”
                </span>
              )}
            </li>
          ))}
          {order.items.length > 3 && (
            <li className="text-muted-foreground text-xs italic">
              + {order.items.length - 3} {t("pos.orderCard.moreItems")}
            </li>
          )}
        </ul>
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>{t("pos.cart.total")}:</span>
          <span>{formatPrice(Number(order.total))}</span>
        </div>
      </div>

      {/* h-10 / size-10: these are the cashier's main targets on an iPad, so
          they sit at the 40px touch minimum rather than sm's 32px. */}
      <div className="mt-4">
        <PosOrderPrimaryAction
          order={order}
          storeId={storeId}
          className="h-10"
          layout="stacked"
          onUpdateStatus={onUpdateStatus}
          onResume={handleResume}
          trailing={
            order.status !== "DELIVERED" ? (
              <Button
                size="icon-lg"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleCancel}
                title={t("pos.orderCard.cancel")}
                aria-label={t("pos.orderCard.cancel")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : undefined
          }
        />
      </div>

      {confirmDialog}
    </div>
  );
}
