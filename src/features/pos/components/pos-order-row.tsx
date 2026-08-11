"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { formatDistanceToNow } from "date-fns";
import { id, enUS, fr } from "date-fns/locale";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import type { PosOrderDisplay } from "../types/pos.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useOrderQueueActions } from "../hooks/use-order-queue-actions";
import { PosOrderPrimaryAction } from "./pos-order-primary-action";
import {
  getOrderSourceBadgeVariant,
  getOrderStatusAccentClass,
  getOrderStatusBadgeClass,
  isAwaitingPayment,
  mapOrderStatusLabel,
  mapPaymentMethodLabel,
} from "../lib/order-status-display";

interface PosOrderRowProps {
  order: PosOrderDisplay;
  storeId: string;
  onUpdateStatus: (orderId: string, status: string) => void;
}

export function PosOrderRow({ order, storeId, onUpdateStatus }: PosOrderRowProps) {
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

  const typeLabel =
    order.orderType === "DINE_IN"
      ? t("pos.checkout.dineIn")
      : order.orderType === "TAKEAWAY"
        ? t("pos.checkout.takeaway")
        : t("pos.history.delivery");

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 text-sm shadow-sm",
        getOrderStatusAccentClass(order.status)
      )}
    >
      <div className="flex min-w-[130px] flex-col">
        <span className="font-semibold">{order.orderNumber}</span>
        <span className="text-muted-foreground text-xs">{timeAgo}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={getOrderStatusBadgeClass(order.status)}>
          {mapOrderStatusLabel(t, order.status)}
        </Badge>
        <Badge variant={getOrderSourceBadgeVariant(order.source)}>
          {order.source === "POS" ? t("pos.source.walkIn") : t("pos.source.online")}
        </Badge>
        <Badge variant="outline">{mapPaymentMethodLabel(t, order.paymentMethod)}</Badge>
        {isAwaitingPayment(order) && (
          <Badge variant="destructive">{t("pos.orderCard.unpaid")}</Badge>
        )}
        <span className="text-muted-foreground hidden text-xs md:inline">{typeLabel}</span>
      </div>

      <div className="min-w-0 flex-1">
        <span className="truncate font-medium">{order.customerName}</span>
        {(order.tableLabel || order.tableNumber) && (
          <span className="text-muted-foreground">
            {" "}
            · {t("pos.orderCard.table")} {order.tableLabel || order.tableNumber}
          </span>
        )}
      </div>

      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {order.items.length} {t("pos.queue.itemsShort")}
      </span>

      <span className="font-semibold whitespace-nowrap">{formatPrice(Number(order.total))}</span>

      <div className="flex shrink-0 gap-2">
        <PosOrderPrimaryAction
          order={order}
          storeId={storeId}
          className="h-7 px-3 text-xs"
          onUpdateStatus={onUpdateStatus}
          onResume={handleResume}
        />
        {order.status !== "DELIVERED" && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 shrink-0 px-2"
            onClick={handleCancel}
            title={t("pos.orderCard.cancel")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
