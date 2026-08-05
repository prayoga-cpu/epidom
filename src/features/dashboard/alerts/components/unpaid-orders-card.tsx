"use client";

import { CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatRelativeTime } from "@/lib/utils/format-date";
import { useUpdateOrderStatus } from "@/features/pos/hooks/use-update-order-status";
import { toast } from "sonner";
import type { UnpaidOrderAlert } from "@/features/dashboard/shared/hooks/use-alerts";

interface UnpaidOrdersCardProps {
  alerts: UnpaidOrderAlert[];
  storeId: string;
}

export function UnpaidOrdersCard({ alerts, storeId }: UnpaidOrdersCardProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const updateStatus = useUpdateOrderStatus(storeId);

  if (alerts.length === 0) return null;

  const handleMarkPaid = async (alert: UnpaidOrderAlert) => {
    try {
      await updateStatus.mutateAsync({ orderId: alert.orderId, paymentStatus: "PAID" });
      toast.success(t("alerts.unpaidOrders.markPaidSuccess"));
    } catch {
      toast.error(t("alerts.unpaidOrders.markPaidFailed"));
    }
  };

  return (
    <div className="bg-card relative z-0 rounded-xl border p-4 shadow-md sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CircleDollarSign className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="truncate text-base font-semibold">{t("alerts.unpaidOrders.title")}</p>
        </div>
        <Badge variant="destructive">
          {t("alerts.unpaidOrders.badge").replace("{n}", String(alerts.length))}
        </Badge>
      </div>

      <ul className="divide-border divide-y rounded-lg border">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="hover:bg-muted/30 flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">{alert.orderNumber}</span>
              <span className="text-muted-foreground ml-2">{alert.customerName}</span>
            </div>
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {t("alerts.unpaidOrders.deliveredAgo").replace(
                "{time}",
                formatRelativeTime(alert.deliveredAt)
              )}
            </span>
            <span className="font-semibold whitespace-nowrap">{formatPrice(Number(alert.total))}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={updateStatus.isPending}
              onClick={() => handleMarkPaid(alert)}
            >
              {t("alerts.unpaidOrders.markPaid")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
