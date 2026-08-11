"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import { useMarkOrderReady } from "../hooks/use-mark-order-ready";
import { MarkPaidDialog, type MarkPaidConfirmData } from "./mark-paid-dialog";
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
  const markReady = useMarkOrderReady(storeId);
  const [showMarkPaid, setShowMarkPaid] = useState(false);

  const handleMarkReady = async () => {
    try {
      await markReady.mutateAsync(order);
    } catch {
      toast.error(t("pos.queue.updateFailed"));
    }
  };

  const handleMarkPaid = async ({ paymentMethod, paymentNote }: MarkPaidConfirmData) => {
    try {
      await updateStatus.mutateAsync({
        orderId: order.id,
        paymentStatus: "PAID",
        paymentMethod,
        paymentNote,
      });
      toast.success(t("pos.orderCard.markPaidSuccess"));
      setShowMarkPaid(false);
    } catch {
      toast.error(t("pos.queue.updateFailed"));
    }
  };

  // Unpaid orders need a Mark as Paid follow-up for their whole time in the
  // active queue now, not just once they land on DELIVERED — Pay Later (and
  // any online payment that never confirms) can sit unpaid all the way from
  // CONFIRMED through READY, since payment no longer gates entry into
  // production. Rendered alongside the stage-progress button below, not in
  // place of it.
  const showMarkPaidAction =
    order.paymentStatus === "PENDING" &&
    (order.status === "CONFIRMED" ||
      order.status === "IN_PRODUCTION" ||
      order.status === "READY" ||
      order.status === "DELIVERED");

  const markPaidButton = showMarkPaidAction ? (
    <Button
      key="mark-paid"
      className={cn("min-w-0", className)}
      size="sm"
      variant="outline"
      disabled={updateStatus.isPending}
      onClick={() => setShowMarkPaid(true)}
    >
      {t("pos.orderCard.markPaid")}
    </Button>
  ) : null;

  // Stage-progress button — one per status with a manual next step.
  // IN_PRODUCTION normally advances to READY on its own, item by item, from
  // the KDS (see advanceOrderToReadyIfAllItemsReady) — this button is a
  // manual override for stores that don't want a cashier switching to
  // Kitchen & Bar for a simple order: it PATCHes every remaining item to
  // READY itself (useMarkOrderReady), which drives the exact same
  // server-side auto-advance the KDS does, rather than writing order.status
  // directly and risking it drifting out of sync with item-level state.
  let stageButton: ReactNode = null;
  if (order.status === "CONFIRMED") {
    stageButton = (
      <Button
        key="stage"
        className={cn("min-w-0", className)}
        size="sm"
        variant="outline"
        onClick={() => onUpdateStatus(order.id, "IN_PRODUCTION")}
      >
        {t("pos.orderCard.startProcess")}
      </Button>
    );
  } else if (order.status === "IN_PRODUCTION") {
    stageButton = (
      <Button
        key="stage"
        className={cn("min-w-0", className)}
        size="sm"
        variant="outline"
        disabled={markReady.isPending}
        onClick={handleMarkReady}
      >
        {t("pos.kds.markAllComplete")}
      </Button>
    );
  } else if (order.status === "READY") {
    stageButton = (
      <Button
        key="stage"
        className={cn("min-w-0 bg-emerald-600 text-white hover:bg-emerald-700", className)}
        size="sm"
        onClick={() => onUpdateStatus(order.id, "DELIVERED")}
      >
        {t("pos.orderCard.complete")}
      </Button>
    );
  } else if (order.status === "HELD") {
    stageButton = (
      <Button key="stage" className={cn("min-w-0", className)} size="sm" onClick={onResume}>
        {t("pos.orderCard.resume")}
      </Button>
    );
  }

  if (!stageButton && !markPaidButton) return null;

  return (
    <>
      {stageButton}
      {markPaidButton}
      {markPaidButton && (
        <MarkPaidDialog
          open={showMarkPaid}
          onOpenChange={setShowMarkPaid}
          onConfirm={handleMarkPaid}
          isSubmitting={updateStatus.isPending}
          description={order.orderNumber}
        />
      )}
    </>
  );
}
