"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { AGGREGATOR_LABELS } from "@/config/aggregator.config";
import type { OrderHistoryItem } from "../types/pos.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import { useRefundOrder } from "../hooks/use-refund-order";
import { useOrderReceiptSends, useSendOrderReceipt } from "../hooks/use-order-receipt-sends";
import { MarkPaidDialog, type MarkPaidConfirmData } from "./mark-paid-dialog";
import { RefundDialog, type RefundConfirmData } from "./refund-dialog";
import { toast } from "sonner";
import { ExternalLink, Send, CheckCircle2, XCircle, Loader2, Printer } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  isBluetoothSupported,
  isPrinterConnected,
  printReceipt,
  type ReceiptData,
} from "@/lib/pwa/thermal-printer";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { SendReceiptWhatsApp } from "./send-receipt-whatsapp";

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
    case "HELD":
      return "secondary";
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
  storeId: string;
  onOpenChange: (open: boolean) => void;
}

export function OrderHistoryDetailDialog({
  order,
  storeId,
  onOpenChange,
}: OrderHistoryDetailDialogProps) {
  const { t, locale, formatDateTimeWithTimezone } = useI18n();
  // Order amounts are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const { confirm, confirmDialog } = useConfirm();
  const updateStatus = useUpdateOrderStatus(storeId);
  const refundOrder = useRefundOrder(storeId);
  const { data: receiptSends } = useOrderReceiptSends(storeId, order?.id);
  const sendReceipt = useSendOrderReceipt(storeId);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);
  const lastReceiptSend = receiptSends?.[0];

  const handleReprint = async () => {
    if (!order) return;
    if (!isBluetoothSupported()) {
      toast.error(t("pos.print.bluetoothUnsupported"));
      return;
    }
    setIsReprinting(true);
    try {
      const res = await apiClient.get<ReceiptData>(
        `/stores/${storeId}/pos/orders/${order.id}/receipt`
      );
      const receipt = (res as any)?.data ?? res;
      if (!isPrinterConnected()) {
        const ok = await usePrinterSettings.getState().connect();
        if (!ok) {
          toast.error(t("pos.print.connectFailed"));
          return;
        }
      }
      // Reprint in the cashier's current dashboard language, not whatever
      // locale the order was originally built with server-side — same
      // override the live checkout print already applies.
      await printReceipt({ ...(receipt as ReceiptData), locale });
      toast.success(t("pos.print.success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pos.print.failed"));
    } finally {
      setIsReprinting(false);
    }
  };

  const handleSendReceipt = async () => {
    if (!order) return;
    try {
      const result = await sendReceipt.mutateAsync(order.id);
      const data = (result as any)?.data ?? result;
      if (data?.sent) {
        toast.success(t("pos.history.receiptSendSuccess"));
      } else {
        toast.error(data?.error || t("pos.history.receiptSendFailed"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pos.history.receiptSendFailed"));
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const wasDelivered = order.status === "DELIVERED";
    const ok = await confirm({
      title: t("pos.orderCard.cancelConfirmTitle"),
      description: wasDelivered
        ? t("pos.orderCard.cancelConfirmDescDelivered")
        : t("pos.orderCard.cancelConfirmDesc"),
      confirmText: t("pos.orderCard.cancel"),
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await updateStatus.mutateAsync({ orderId: order.id, status: "CANCELLED" });
      toast.success(t("pos.orderCard.cancelSuccess"));
      onOpenChange(false);
    } catch {
      toast.error(t("pos.queue.updateFailed"));
    }
  };

  const handleMarkPaid = async ({ paymentMethod, paymentNote }: MarkPaidConfirmData) => {
    if (!order) return;
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

  const handleRefund = async ({ amount, reason }: RefundConfirmData) => {
    if (!order) return;
    try {
      await refundOrder.mutateAsync({ orderId: order.id, amount, reason });
      toast.success(t("pos.refund.success"));
      setShowRefund(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pos.queue.updateFailed"));
    }
  };

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

  const remainingRefundable = order
    ? Math.max(0, Number(order.total) - Number(order.refundAmount ?? 0))
    : 0;

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {t("pos.history.detailTitle")}
                <span className="font-mono">{order.orderNumber}</span>
              </DialogTitle>
              <DialogDescription>{formatDateTimeWithTimezone(order.orderDate)}</DialogDescription>
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
                  <span className="shrink-0 text-right">{formatPrice(Number(item.total))}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.cart.subtotal")}</span>
                <span>{formatPrice(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.cart.tax")}</span>
                <span>{formatPrice(Number(order.tax))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.history.delivery")}</span>
                <span>{formatPrice(Number(order.delivery))}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("pos.cart.discount")}
                    {order.discountReason ? ` (${order.discountReason})` : ""}
                  </span>
                  <span className="text-orange-600">
                    -{formatPrice(Number(order.discountAmount))}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>{t("pos.cart.total")}</span>
                <span>{formatPrice(Number(order.total))}</span>
              </div>
              {Number(order.refundAmount) > 0 && (
                <div className="text-destructive flex justify-between">
                  <span>
                    {t("pos.refund.refunded")}
                    {order.refundReason ? ` (${order.refundReason})` : ""}
                  </span>
                  <span>-{formatPrice(Number(order.refundAmount))}</span>
                </div>
              )}
            </div>

            {order.paymentNote && (
              <div className="text-sm">
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  {t("pos.history.detailPaymentNote")}
                </p>
                <p>{order.paymentNote}</p>
              </div>
            )}

            {order.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  {t("pos.history.detailNotes")}
                </p>
                <p>{order.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`/r/${order.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("pos.history.viewReceipt")}
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isReprinting}
                onClick={handleReprint}
              >
                {isReprinting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                {t("pos.print.reprint")}
              </Button>
              {order.customerPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={sendReceipt.isPending}
                  onClick={handleSendReceipt}
                >
                  {sendReceipt.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {sendReceipt.isPending
                    ? t("pos.history.sendingReceipt")
                    : lastReceiptSend
                      ? t("pos.history.resendReceipt")
                      : t("pos.history.sendReceipt")}
                </Button>
              )}
              {lastReceiptSend && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    lastReceiptSend.status === "SENT"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {lastReceiptSend.status === "SENT" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {lastReceiptSend.status === "SENT"
                    ? t("pos.history.receiptSent")
                    : t("pos.history.receiptFailed")}{" "}
                  · {formatDateTimeWithTimezone(lastReceiptSend.sentAt)}
                </span>
              )}
            </div>

            <SendReceiptWhatsApp
              storeId={storeId}
              orderId={order.id}
              customerName={order.customerName}
              customerPhone={order.customerPhone}
              total={Number(order.total)}
              currency={currency}
              orderDate={order.orderDate}
              className="border-t pt-3"
            />

            {order.deliveredDate && (
              <p className="text-muted-foreground text-xs">
                {t("pos.history.detailDelivered")}: {formatDateTimeWithTimezone(order.deliveredDate)}
              </p>
            )}

            {order.status !== "CANCELLED" && (
              <DialogFooter>
                {order.paymentStatus === "PENDING" && (
                  <Button
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => setShowMarkPaid(true)}
                  >
                    {t("pos.orderCard.markPaid")}
                  </Button>
                )}
                {(order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") &&
                  remainingRefundable > 0 && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={refundOrder.isPending}
                      onClick={() => setShowRefund(true)}
                    >
                      {t("pos.refund.action")}
                    </Button>
                  )}
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={updateStatus.isPending}
                  onClick={handleCancel}
                >
                  {t("pos.orderCard.cancel")}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
      {confirmDialog}
      <MarkPaidDialog
        open={showMarkPaid}
        onOpenChange={setShowMarkPaid}
        onConfirm={handleMarkPaid}
        isSubmitting={updateStatus.isPending}
        description={order?.orderNumber}
      />
      <RefundDialog
        open={showRefund}
        onOpenChange={setShowRefund}
        onConfirm={handleRefund}
        isSubmitting={refundOrder.isPending}
        orderNumber={order?.orderNumber}
        remainingAmount={remainingRefundable}
      />
    </Dialog>
  );
}
