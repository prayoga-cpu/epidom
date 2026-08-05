"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import type { PosOrderDisplay } from "../types/pos.types";

interface PosOrderPrimaryActionProps {
  order: PosOrderDisplay;
  storeId: string;
  className?: string;
  onUpdateStatus: (orderId: string, status: string) => void;
  onResume: () => void;
}

export function PosOrderPrimaryAction({
  order,
  storeId,
  className,
  onUpdateStatus,
  onResume,
}: PosOrderPrimaryActionProps) {
  const { t } = useI18n();
  const updateStatus = useUpdateOrderStatus(storeId);

  const handleMarkPaid = async () => {
    try {
      await updateStatus.mutateAsync({ orderId: order.id, paymentStatus: "PAID" });
      toast.success(t("pos.orderCard.markPaidSuccess"));
    } catch {
      toast.error(t("pos.queue.updateFailed"));
    }
  };

  // Delivered orders only reach this card while payment is still pending
  // (see ACTIVE_POS_QUEUE_FILTER) — this is the follow-up action for that.
  if (order.status === "DELIVERED" && order.paymentStatus === "PENDING") {
    return (
      <Button
        className={cn("min-w-0", className)}
        size="sm"
        variant="outline"
        disabled={updateStatus.isPending}
        onClick={handleMarkPaid}
      >
        {t("pos.orderCard.markPaid")}
      </Button>
    );
  }

  if (order.status === "PENDING") {
    return (
      <Button
        className={cn("min-w-0", className)}
        size="sm"
        onClick={() => onUpdateStatus(order.id, "CONFIRMED")}
      >
        {t("pos.orderCard.confirm")}
      </Button>
    );
  }

  if (order.status === "CONFIRMED") {
    return (
      <Button
        className={cn("min-w-0", className)}
        size="sm"
        variant="outline"
        onClick={() => onUpdateStatus(order.id, "IN_PRODUCTION")}
      >
        {t("pos.orderCard.startProcess")}
      </Button>
    );
  }

  if (order.status === "READY") {
    return (
      <Button
        className={cn("min-w-0 bg-emerald-600 text-white hover:bg-emerald-700", className)}
        size="sm"
        onClick={() => onUpdateStatus(order.id, "DELIVERED")}
      >
        {t("pos.orderCard.complete")}
      </Button>
    );
  }

  if (order.status === "HELD") {
    return (
      <Button className={cn("min-w-0", className)} size="sm" onClick={onResume}>
        {t("pos.orderCard.resume")}
      </Button>
    );
  }

  return null;
}
