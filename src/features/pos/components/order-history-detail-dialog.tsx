"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatting";
import { AGGREGATOR_LABELS } from "@/config/aggregator.config";
import type { OrderHistoryItem } from "../types/pos.types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getSourceBadgeVariant(source: string) {
  switch (source) {
    case "POS":
      return "default";
    case "STOREFRONT":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "CONFIRMED":
      return "default";
    case "IN_PRODUCTION":
      return "outline";
    case "READY":
      return "default";
    case "DELIVERED":
      return "default";
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

function getPaymentBadgeVariant(paymentStatus: string) {
  switch (paymentStatus) {
    case "PAID":
      return "default";
    case "PENDING":
      return "secondary";
    case "FAILED":
      return "destructive";
    case "EXPIRED":
      return "destructive";
    default:
      return "outline";
  }
}

interface OrderHistoryDetailDialogProps {
  order: OrderHistoryItem | null;
  onOpenChange: (open: boolean) => void;
}

export function OrderHistoryDetailDialog({ order, onOpenChange }: OrderHistoryDetailDialogProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();

  const mapStatusLabel = (s: string) => {
    const key = s === "IN_PRODUCTION" ? "inProduction" : s.toLowerCase();
    return t(`pos.status.${key}`);
  };

  const mapSourceLabel = (s: string) => {
    switch (s) {
      case "MANUAL":
        return t("pos.history.sourceManual");
      case "STOREFRONT":
        return t("pos.history.sourceStorefront");
      case "POS":
        return t("pos.history.sourcePos");
      default:
        return AGGREGATOR_LABELS[s as keyof typeof AGGREGATOR_LABELS] ?? s;
    }
  };

  const mapPaymentLabel = (s: string) => {
    switch (s) {
      case "PAID":
        return t("pos.history.paymentPaid");
      case "PENDING":
        return t("pos.history.paymentPending");
      case "FAILED":
        return t("pos.history.paymentFailed");
      case "EXPIRED":
        return t("pos.history.paymentExpired");
      case "REFUNDED":
        return t("pos.history.paymentRefunded");
      default:
        return s;
    }
  };

  const mapTypeLabel = (orderType: string) => {
    switch (orderType) {
      case "DINE_IN":
        return t("pos.checkout.dineIn");
      case "TAKEAWAY":
        return t("pos.checkout.takeaway");
      default:
        return t("pos.history.delivery");
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {t("pos.history.detailTitle")}
                <span className="font-mono">{order.orderNumber}</span>
              </DialogTitle>
              <DialogDescription>{formatDateTime(order.orderDate)}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Badge variant={getStatusBadgeVariant(order.status)}>
                {mapStatusLabel(order.status)}
              </Badge>
              <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                {mapPaymentLabel(order.paymentStatus)}
              </Badge>
              <Badge variant={getSourceBadgeVariant(order.source)}>
                {mapSourceLabel(order.source)}
              </Badge>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.orderCard.customer")}:</span>
                <span className="font-medium">
                  {order.customerName}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.orderCard.type")}:</span>
                <span className="font-medium">
                  {mapTypeLabel(order.orderType)}
                  {order.table?.label ? ` · ${order.table.label}` : ""}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t pt-3 text-sm">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4">
                  <span>
                    {Number(item.quantity)}x {item.menuItem?.name ?? item.name}
                  </span>
                  <span className="shrink-0 text-right">
                    {formatCurrency(Number(item.total), currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.cart.subtotal")}</span>
                <span>{formatCurrency(Number(order.subtotal), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.cart.tax")}</span>
                <span>{formatCurrency(Number(order.tax), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.history.delivery")}</span>
                <span>{formatCurrency(Number(order.delivery), currency)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("pos.cart.total")}</span>
                <span>{formatCurrency(Number(order.total), currency)}</span>
              </div>
            </div>

            {order.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  {t("pos.history.detailNotes")}
                </p>
                <p>{order.notes}</p>
              </div>
            )}

            {order.deliveredDate && (
              <p className="text-muted-foreground text-xs">
                {t("pos.history.detailDelivered")}: {formatDateTime(order.deliveredDate)}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
