"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { ReceiptText, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PosOrderDisplay } from "../types/pos.types";
import { useOrderQueueActions } from "../hooks/use-order-queue-actions";
import { PosOrderPrimaryAction } from "./pos-order-primary-action";
import { formatQueueNumber } from "../lib/queue-number";
import { orderSourceBadgeLabel, saleTypeText } from "../lib/order-channel";
import {
  getOrderSourceBadgeVariant,
  getOrderStatusBadgeClass,
  isAwaitingPayment,
  mapOrderStatusLabel,
  mapPaymentMethodLabel,
} from "../lib/order-status-display";

interface PosOrderDetailPanelProps {
  /** The selected order, or null for the "pick an order" empty state. */
  order: PosOrderDisplay | null;
  storeId: string;
  onUpdateStatus: (orderId: string, status: string) => void;
  /** Classes for the outer frame — the split view sizes it (docked column vs sheet). */
  className?: string;
}

/**
 * The split view's right column: everything about one order — who and where,
 * what was ordered, how it was paid, the totals — with the same actions the
 * card view has (advance, mark paid, resume, cancel) pinned to the bottom.
 */
export function PosOrderDetailPanel({
  order,
  storeId,
  onUpdateStatus,
  className,
}: PosOrderDetailPanelProps) {
  if (!order) return <EmptyDetail className={className} />;
  // Keyed by id so the mark-paid dialog / confirm state of one order never
  // carries over to the next one selected.
  return (
    <OrderDetail
      key={order.id}
      order={order}
      storeId={storeId}
      onUpdateStatus={onUpdateStatus}
      className={className}
    />
  );
}

function EmptyDetail({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "bg-card text-muted-foreground flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center",
        className
      )}
    >
      <ReceiptText className="size-8 opacity-50" />
      <p className="text-foreground text-sm font-medium">{t("pos.queue.detailEmptyTitle")}</p>
      <p className="text-xs">{t("pos.queue.detailEmptyDesc")}</p>
    </div>
  );
}

function OrderDetail({
  order,
  storeId,
  onUpdateStatus,
  className,
}: Omit<PosOrderDetailPanelProps, "order"> & { order: PosOrderDisplay }) {
  const { t } = useI18n();
  // Order totals are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const { handleCancel, handleResume, confirmDialog } = useOrderQueueActions(
    order,
    storeId,
    onUpdateStatus
  );

  const typeLabel = saleTypeText(t, order.orderType);
  const table = order.tableLabel || order.tableNumber;
  const tenders = order.payments ?? [];
  const awaitingPayment = isAwaitingPayment(order);
  // The footer is only worth its space while there is something to press: a
  // delivered-and-paid order (which never shows in the queue) has no actions.
  const hasActions = order.status !== "DELIVERED" || awaitingPayment;

  // Charges are frozen on the order at creation; only the ones that applied are
  // worth a line, so a zero (or an order that predates the field) is skipped.
  const charges: { label: string; amount: number; negative?: boolean }[] = [];
  if ((order.discountAmount ?? 0) > 0)
    charges.push({ label: t("pos.cart.discount"), amount: order.discountAmount!, negative: true });
  if ((order.serviceCharge ?? 0) > 0)
    charges.push({ label: t("pos.cart.serviceCharge"), amount: order.serviceCharge! });
  if ((order.tax ?? 0) > 0) charges.push({ label: t("pos.cart.tax"), amount: order.tax! });
  if ((order.delivery ?? 0) > 0)
    charges.push({ label: t("pos.history.delivery"), amount: order.delivery! });

  return (
    <div
      className={cn("bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border", className)}
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-sm font-semibold break-all">{order.orderNumber}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={getOrderStatusBadgeClass(order.status)}>
              {mapOrderStatusLabel(t, order.status)}
            </Badge>
            <Badge variant={getOrderSourceBadgeVariant(order.source)}>
              {orderSourceBadgeLabel(t, order.source)}
            </Badge>
            {awaitingPayment && <Badge variant="destructive">{t("pos.orderCard.unpaid")}</Badge>}
          </div>
        </div>
        <div className="bg-muted flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5">
          <span className="text-muted-foreground text-[10px] leading-none font-medium uppercase">
            {t("pos.queue.detailQueue")}
          </span>
          <span className="text-2xl leading-tight font-bold tabular-nums">
            {formatQueueNumber(order.queueNumber)}
          </span>
        </div>
      </header>

      {/* min-h-0 + flex-1: the body is the part that scrolls, so the header and the
          action footer stay put however long the order is. */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          <DetailRow
            label={t("pos.queue.detailOrderTime")}
            value={format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}
          />
          <DetailRow label={t("pos.queue.detailCashier")} value={order.shift?.staffMember.name} />
          <DetailRow label={t("pos.orderCard.table")} value={table} />
          <DetailRow label={t("pos.queue.detailGuests")} value={order.guestCount} />
          <DetailRow label={t("pos.orderCard.customer")} value={order.customerName} />
          <DetailRow label={t("pos.queue.detailPhone")} value={order.customerPhone} />
          <DetailRow label={t("pos.queue.detailEmail")} value={order.customerEmail} />
          <DetailRow label={t("pos.orderCard.type")} value={typeLabel} />
        </dl>

        <section>
          <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
            {t("pos.orderCard.itemsLabel")} ({order.items.length})
          </h3>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p>
                    {item.quantity}x {item.menuItem?.name || item.name}
                  </p>
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {item.selectedOptions.map((o) => o.optionName).join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-muted-foreground text-xs italic">“{item.notes}”</p>
                  )}
                </div>
                <span className="shrink-0 tabular-nums">{formatPrice(Number(item.total))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
            {t("pos.queue.detailPayment")}
          </h3>
          {tenders.length > 0 ? (
            <ul className="space-y-1">
              {tenders.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>{p.note || mapPaymentMethodLabel(t, p.method)}</span>
                  <span className="tabular-nums">{formatPrice(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn(awaitingPayment && "text-destructive")}>
              {awaitingPayment
                ? `${t("pos.queue.detailNotPaid")} · ${mapPaymentMethodLabel(t, order.paymentMethod)}`
                : mapPaymentMethodLabel(t, order.paymentMethod)}
            </p>
          )}
        </section>

        <dl className="space-y-1 border-t pt-3">
          <TotalRow label={t("pos.cart.subtotal")} value={formatPrice(Number(order.subtotal))} />
          {charges.map((c) => (
            <TotalRow
              key={c.label}
              label={c.label}
              value={`${c.negative ? "−" : ""}${formatPrice(c.amount)}`}
            />
          ))}
          <div className="flex justify-between gap-3 pt-1 text-base font-bold">
            <dt>{t("pos.cart.total")}</dt>
            <dd className="tabular-nums">{formatPrice(Number(order.total))}</dd>
          </div>
        </dl>

        {order.notes && (
          <section>
            <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
              {t("pos.queue.detailNotes")}
            </h3>
            <p className="whitespace-pre-wrap">{order.notes}</p>
          </section>
        )}
      </div>

      {hasActions && (
        <footer className="shrink-0 border-t p-3">
          {/* h-11 / icon-lg: the cashier's main targets on an iPad, at the touch floor. */}
          <PosOrderPrimaryAction
            order={order}
            storeId={storeId}
            className="h-11"
            layout="stacked"
            onUpdateStatus={onUpdateStatus}
            onResume={handleResume}
            trailing={
              order.status !== "DELIVERED" ? (
                <Button
                  size="icon-lg"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive size-11"
                  onClick={handleCancel}
                  title={t("pos.orderCard.cancel")}
                  aria-label={t("pos.orderCard.cancel")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : undefined
            }
          />
        </footer>
      )}

      {confirmDialog}
    </div>
  );
}

/** A label/value pair in the meta grid — renders nothing for an absent value. */
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
    </>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
