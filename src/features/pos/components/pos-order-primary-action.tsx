"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PosOrderDisplay } from "../types/pos.types";

interface PosOrderPrimaryActionProps {
  order: PosOrderDisplay;
  className?: string;
  onUpdateStatus: (orderId: string, status: string) => void;
  onResume: () => void;
}

export function PosOrderPrimaryAction({
  order,
  className,
  onUpdateStatus,
  onResume,
}: PosOrderPrimaryActionProps) {
  const { t } = useI18n();

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
