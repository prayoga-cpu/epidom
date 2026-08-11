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
  /**
   * "inline" (default) emits bare buttons for the caller's own row — used by
   * the compact list view, which has a `shrink-0` container and room to spare.
   * "stacked" wraps them in a width-aware grid for the card view.
   */
  layout?: "inline" | "stacked";
  /** Trailing control (the cancel ✕) laid out with the actions in "stacked". */
  trailing?: ReactNode;
}

export function PosOrderPrimaryAction({
  order,
  storeId,
  className,
  onUpdateStatus,
  onResume,
  layout = "inline",
  trailing,
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
      <ActionLabel>{t("pos.orderCard.markPaid")}</ActionLabel>
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
        <ActionLabel>{t("pos.orderCard.startProcess")}</ActionLabel>
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
        <ActionLabel>{t("pos.kds.markAllComplete")}</ActionLabel>
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
        <ActionLabel>{t("pos.orderCard.complete")}</ActionLabel>
      </Button>
    );
  } else if (order.status === "HELD") {
    stageButton = (
      <Button key="stage" className={cn("min-w-0", className)} size="sm" onClick={onResume}>
        <ActionLabel>{t("pos.orderCard.resume")}</ActionLabel>
      </Button>
    );
  }

  const dialog = markPaidButton && (
    <MarkPaidDialog
      open={showMarkPaid}
      onOpenChange={setShowMarkPaid}
      onConfirm={handleMarkPaid}
      isSubmitting={updateStatus.isPending}
      description={order.orderNumber}
    />
  );

  if (layout === "inline") {
    return (
      <>
        {stageButton}
        {markPaidButton}
        {trailing}
        {dialog}
      </>
    );
  }

  // Card layout. A grid, not a flex row: Button's own `shrink-0` beats a
  // `flex-1`/`min-w-0` sibling, so in flex these boxes keep their full label
  // width and spill over each other once the card gets narrow (the labels
  // visibly overlapped at three buttons). Grid tracks size to the container
  // instead, and `min-w-0` + truncate on the buttons ellipsizes a long label
  // rather than letting it escape.
  //
  //   [ Mark as Paid ] [✕]      two actions: the secondary shares the top row
  //   [    Complete     ]       with cancel, the stage action gets its own
  //
  // With a single action it stays one row: [ Start Process ] [✕].
  const [inlineAction, fullWidthAction] =
    stageButton && markPaidButton
      ? [markPaidButton, stageButton]
      : [stageButton ?? markPaidButton, null];

  if (!inlineAction) return trailing ? <div className="flex justify-end">{trailing}</div> : null;

  return (
    <div
      className={cn(
        "grid w-full items-center gap-2",
        trailing ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"
      )}
    >
      {inlineAction}
      {trailing}
      {fullWidthAction && <div className="col-span-full grid">{fullWidthAction}</div>}
      {dialog}
    </div>
  );
}

/** Ellipsizes instead of letting a long label escape a squeezed button. */
function ActionLabel({ children }: { children: ReactNode }) {
  return <span className="truncate">{children}</span>;
}
