"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import type { PosOrderDisplay } from "../types/pos.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { id, enUS } from "date-fns/locale";
import { usePathname } from "next/navigation";

interface PosOrderCardProps {
  order: PosOrderDisplay;
  onUpdateStatus: (orderId: string, status: string) => void;
}

export function PosOrderCard({ order, onUpdateStatus }: PosOrderCardProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const pathname = usePathname();
  const dateLocale = pathname.startsWith("/en") ? enUS : id;

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
        return "default"; // Maybe a different color in custom CSS
      default:
        return "outline";
    }
  };

  const mapStatusLabel = (status: string) => {
    const key = status === "IN_PRODUCTION" ? "inProduction" : status.toLowerCase();
    return t(`pos.status.${key}`);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{order.orderNumber}</span>
            <Badge variant={getSourceBadgeVariant(order.source)}>
              {order.source === "POS" ? t("pos.source.walkIn") : t("pos.source.online")}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <Badge variant={getStatusBadgeVariant(order.status)} className="px-2 py-1">
          {mapStatusLabel(order.status)}
        </Badge>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pelanggan:</span>
          <span className="font-medium">{order.customerName}</span>
        </div>
        {(order.tableLabel || order.tableNumber) && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Meja:</span>
            <span className="font-medium">{order.tableLabel || order.tableNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipe:</span>
          <span className="font-medium">
            {order.orderType === "DINE_IN" ? "Dine In" : "Takeaway"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 border-t pt-3">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Item Pesanan ({order.items.length})</span>
        <ul className="text-sm">
          {order.items.slice(0, 3).map((item, i) => (
            <li key={i} className="flex justify-between py-0.5">
              <span>{item.quantity}x {item.menuItem?.name || item.name}</span>
            </li>
          ))}
          {order.items.length > 3 && (
            <li className="text-muted-foreground text-xs italic">
              + {order.items.length - 3} item lainnya
            </li>
          )}
        </ul>
        <div className="mt-2 flex justify-between font-semibold border-t pt-2">
          <span>Total:</span>
          <span>{formatCurrency(Number(order.total), currency)}</span>
        </div>
      </div>

      {/* Action Buttons based on status */}
      <div className="mt-4 flex gap-2">
        {order.status === "PENDING" && (
          <Button 
            className="w-full" 
            size="sm"
            onClick={() => onUpdateStatus(order.id, "CONFIRMED")}
          >
            Konfirmasi
          </Button>
        )}
        {order.status === "CONFIRMED" && (
          <Button 
            className="w-full" 
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(order.id, "IN_PRODUCTION")}
          >
            Mulai Proses
          </Button>
        )}
        {order.status === "READY" && (
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
            size="sm"
            onClick={() => onUpdateStatus(order.id, "DELIVERED")}
          >
            Selesaikan
          </Button>
        )}
      </div>
    </div>
  );
}
