"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useCurrency } from "@/components/providers/currency-provider";
import type { PosOrderDisplay } from "../types/pos.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { id, enUS, fr } from "date-fns/locale";
import { useConfirm } from "@/components/ui/use-confirm";
import { usePosCart } from "../hooks/use-pos-cart";
import { toast } from "sonner";

interface PosOrderCardProps {
  order: PosOrderDisplay;
  storeId: string;
  onUpdateStatus: (orderId: string, status: string) => void;
}

export function PosOrderCard({ order, storeId, onUpdateStatus }: PosOrderCardProps) {
  const { t, locale } = useI18n();
  const { formatPrice } = useCurrency();
  const { confirm, confirmDialog } = useConfirm();
  const router = useRouter();
  const cart = usePosCart();

  const handleCancel = async () => {
    const ok = await confirm({
      title: t("pos.orderCard.cancelConfirmTitle"),
      description: t("pos.orderCard.cancelConfirmDesc"),
      confirmText: t("pos.orderCard.cancel"),
      variant: "destructive",
    });
    if (ok) onUpdateStatus(order.id, "CANCELLED");
  };

  const handleResume = async () => {
    if (cart.items.length > 0) {
      const ok = await confirm({
        title: t("pos.orderCard.resumeConfirmTitle"),
        description: t("pos.orderCard.resumeConfirmDesc"),
        confirmText: t("pos.orderCard.resume"),
      });
      if (!ok) return;
    }

    const mapped = order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId ?? "",
      name: item.menuItem?.name ?? item.name,
      // Number(...) defensively: these should already be plain numbers from
      // the API, but a Prisma Decimal that slips through unconverted
      // serializes as a *string*, which would silently turn every total
      // calculation downstream into string concatenation instead of addition.
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      // Not persisted on OrderItem — see pos.orderCard.resumedBanner.
      modifiers: [],
      lineTotal: Number(item.total),
    }));

    cart.hydrateFromOrder(mapped, order.id);
    toast.success(t("pos.orderCard.resumeSuccess"));
    router.push(`/store/${storeId}/pos`);
  };

  const dateLocaleMap = { en: enUS, id, fr };
  const dateLocale = dateLocaleMap[locale] ?? id;

  const timeAgo = formatDistanceToNow(new Date(order.createdAt), {
    addSuffix: true,
    locale: dateLocale,
  });

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case "POS":
        return "default";
      case "STOREFRONT":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "CONFIRMED":
        return "default";
      case "IN_PRODUCTION":
        return "outline";
      case "READY":
        return "default";
      case "HELD":
        return "secondary";
      default:
        return "outline";
    }
  };

  const mapStatusLabel = (status: string) => {
    const key = status === "IN_PRODUCTION" ? "inProduction" : status.toLowerCase();
    return t(`pos.status.${key}`);
  };

  return (
    <div className="bg-card text-card-foreground flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      <div className="flex items-start justify-between border-b pb-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{order.orderNumber}</span>
          <span className="text-muted-foreground text-xs">{timeAgo}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={getStatusBadgeVariant(order.status)} className="px-2 py-1">
            {mapStatusLabel(order.status)}
          </Badge>
          <Badge variant={getSourceBadgeVariant(order.source)}>
            {order.source === "POS" ? t("pos.source.walkIn") : t("pos.source.online")}
          </Badge>
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
            <li key={i} className="flex justify-between py-0.5">
              <span>
                {item.quantity}x {item.menuItem?.name || item.name}
              </span>
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

      <div className="mt-4 flex gap-2">
        {order.status === "PENDING" && (
          <Button
            className="min-w-0 flex-1"
            size="sm"
            onClick={() => onUpdateStatus(order.id, "CONFIRMED")}
          >
            {t("pos.orderCard.confirm")}
          </Button>
        )}
        {order.status === "CONFIRMED" && (
          <Button
            className="min-w-0 flex-1"
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(order.id, "IN_PRODUCTION")}
          >
            {t("pos.orderCard.startProcess")}
          </Button>
        )}
        {order.status === "READY" && (
          <Button
            className="min-w-0 flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
            onClick={() => onUpdateStatus(order.id, "DELIVERED")}
          >
            {t("pos.orderCard.complete")}
          </Button>
        )}
        {order.status === "HELD" && (
          <Button className="min-w-0 flex-1" size="sm" onClick={handleResume}>
            {t("pos.orderCard.resume")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 px-2.5"
          onClick={handleCancel}
          title={t("pos.orderCard.cancel")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {confirmDialog}
    </div>
  );
}
