"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Printer,
  Send,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { isSubscriptionError } from "@/lib/utils/types";
import {
  useCancelSupplierOrder,
  useReceiveSupplierOrder,
  useSupplierOrders,
  type SupplierOrder,
} from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { SubscriptionLockedState } from "@/features/dashboard/shared/components/subscription-locked-state";
import { SectionErrorState } from "@/features/dashboard/data/components/section-error-state";
import { ConfirmReceivedDialog } from "./confirm-received-dialog";
import { expectedCalendarDay, getDeliveryTiming, type DeliveryTiming } from "./delivery-timing";

/** Open = created and not yet received or cancelled. PENDING is legacy (see the POST route). */
export const isOpenSupplierOrder = (order: SupplierOrder) =>
  order.status === "PLACED" || order.status === "PENDING";

/** Oldest expected day first, so late orders lead; orders with no date go last. */
function byExpectedDay(a: SupplierOrder, b: SupplierOrder) {
  if (!a.expectedDate) return b.expectedDate ? 1 : 0;
  if (!b.expectedDate) return -1;
  return (
    expectedCalendarDay(a.expectedDate).getTime() - expectedCalendarDay(b.expectedDate).getTime()
  );
}

interface OpenOrdersListProps {
  storeId: string;
  onSend: (orderId: string) => void;
  onPrint: (orderId: string) => void;
  onEdit: (order: SupplierOrder) => void;
}

/**
 * Every supplier order that is on its way, each with one button: Received.
 * The status beside it is not set by anyone: it is read off the expected
 * delivery date, so an order that doesn't show up turns Late by itself.
 */
export function OpenOrdersList({ storeId, onSend, onPrint, onEdit }: OpenOrdersListProps) {
  const { t, formatDate } = useI18n();
  const { supplierManagementAccess, isLoading: isLoadingAccess } = useFeatureAccess();
  const { data, isLoading, error, refetch } = useSupplierOrders(storeId);
  const receive = useReceiveSupplierOrder(storeId);
  const cancel = useCancelSupplierOrder(storeId);

  const [toReceive, setToReceive] = useState<SupplierOrder | null>(null);
  const [toCancel, setToCancel] = useState<SupplierOrder | null>(null);

  const openOrders = useMemo(
    () => (data?.orders ?? []).filter(isOpenSupplierOrder).sort(byExpectedDay),
    [data]
  );

  const itemsSummary = (order: SupplierOrder) => {
    const shown = order.items
      .slice(0, 2)
      .map((item) => `${item.material.name} ${Number(item.quantity)} ${item.unit}`);
    const rest = order.items.length - shown.length;
    if (rest > 0) {
      shown.push(t("management.delivery.openOrders.moreItems").replace("{count}", String(rest)));
    }
    return shown.join(" · ");
  };

  const timingLabel = (timing: DeliveryTiming) => {
    switch (timing.kind) {
      case "upcoming":
        return timing.days === 1
          ? t("management.delivery.timing.arrivesTomorrow")
          : t("management.delivery.timing.arrivesInDays").replace("{days}", String(timing.days));
      case "dueToday":
        return t("management.delivery.timing.dueToday");
      case "late":
        return timing.days === 1
          ? t("management.delivery.timing.lateOneDay")
          : t("management.delivery.timing.lateDays").replace("{days}", String(timing.days));
      default:
        return t("management.delivery.timing.noDate");
    }
  };

  const handleConfirmReceived = (order: SupplierOrder) => {
    receive.mutate(order.id, {
      onSuccess: () => {
        toast.success(t("management.delivery.confirmReceived.success"), {
          description: itemsSummary(order),
        });
      },
      onError: (err) => {
        toast.error(t("management.delivery.confirmReceived.failed"), { description: err.message });
      },
      // Closed either way: on a 409 (already received from another tap or
      // device) the refetch drops the row, and any other failure is retried
      // from the row's own button.
      onSettled: () => setToReceive(null),
    });
  };

  const handleConfirmCancel = () => {
    if (!toCancel) return;
    cancel.mutate(toCancel.id, {
      onSuccess: () => toast.success(t("management.delivery.confirmCancel.success")),
      onError: (err) =>
        toast.error(t("management.delivery.confirmCancel.failed"), { description: err.message }),
    });
    setToCancel(null);
  };

  const isSubscriptionLocked =
    (!isLoadingAccess && !supplierManagementAccess) ||
    (error &&
      (isSubscriptionError(error) ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "SUBSCRIPTION_FEATURE_LOCKED") ||
        ("status" in error && error.status === 403)));

  if (isLoading || isLoadingAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Loader2 className="text-muted-foreground mb-3 h-6 w-6 animate-spin" />
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  if (isSubscriptionLocked) {
    return <SubscriptionLockedState title={t("data.suppliers.locked")} className="min-h-[320px]" />;
  }

  if (error) {
    return (
      <SectionErrorState
        title={t("common.error")}
        message={error.message || t("alerts.errorLoadingOrders")}
        onRetry={() => refetch()}
        retryLabel={t("common.actions.retry")}
      />
    );
  }

  return (
    <>
      {openOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center">
          <div className="bg-primary/10 mb-3 rounded-full p-3">
            <Package className="text-primary h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-semibold">
            {t("management.delivery.openOrders.empty")}
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            {t("management.delivery.openOrders.emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {openOrders.map((order) => {
            const timing = getDeliveryTiming(order.expectedDate);
            const TimingIcon =
              timing.kind === "late" ? AlertTriangle : timing.kind === "upcoming" ? Truck : Clock;

            return (
              <li key={order.id} className="rounded-lg border p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate font-semibold">{order.supplier.name}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 whitespace-nowrap",
                          timing.kind === "dueToday" &&
                            "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                          timing.kind === "late" &&
                            "border-destructive/40 bg-destructive/10 text-destructive"
                        )}
                      >
                        <TimingIcon className="h-3 w-3" />
                        {timingLabel(timing)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs break-all">
                      {order.orderNumber}
                      {order.expectedDate &&
                        ` · ${t("management.delivery.openOrders.expected").replace(
                          "{date}",
                          formatDate(expectedCalendarDay(order.expectedDate))
                        )}`}
                    </p>
                    <p className="text-sm">{itemsSummary(order)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          aria-label={t("management.delivery.openOrders.moreActions")}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem className="min-h-10" onSelect={() => onSend(order.id)}>
                          <Send />
                          {t("management.delivery.sendToSupplier")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="min-h-10" onSelect={() => onPrint(order.id)}>
                          <Printer />
                          {t("management.delivery.openOrders.print")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="min-h-10" onSelect={() => onEdit(order)}>
                          <Pencil />
                          {t("management.delivery.openOrders.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          className="min-h-10"
                          onSelect={() => setToCancel(order)}
                        >
                          <XCircle />
                          {t("management.delivery.openOrders.cancel")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* flex-1, not w-full: w-full would claim the whole row on
                        top of the menu button beside it and overflow it. */}
                    <Button
                      className="h-10 flex-1 sm:flex-none"
                      onClick={() => setToReceive(order)}
                      disabled={receive.isPending && receive.variables === order.id}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {t("management.delivery.openOrders.received")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmReceivedDialog
        order={toReceive}
        onOpenChange={(open) => !open && setToReceive(null)}
        onConfirm={handleConfirmReceived}
        isPending={receive.isPending}
      />

      <AlertDialog open={!!toCancel} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("management.delivery.confirmCancel.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel && (
                <span className="text-foreground mb-1 block font-medium">
                  {toCancel.supplier.name} · {toCancel.orderNumber}
                </span>
              )}
              {t("management.delivery.confirmCancel.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("management.delivery.confirmCancel.keep")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("management.delivery.confirmCancel.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
