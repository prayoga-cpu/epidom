"use client";

import { format } from "date-fns";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PosOrderDisplay } from "../types/pos.types";
import { formatQueueNumber } from "../lib/queue-number";
import { getOrderStatusDotClass, mapOrderStatusLabel } from "../lib/order-status-display";

interface PosOrderListTableProps {
  orders: PosOrderDisplay[];
  selectedId: string | null;
  onSelect: (order: PosOrderDisplay) => void;
}

/**
 * The split view's middle column: one row per open order with exactly the six
 * details a cashier scans for — order no., time, queue no., customer, table and
 * total. Everything else (items, payment, actions) lives in the detail panel, so
 * a row is a target to tap, not a card to read.
 */
export function PosOrderListTable({ orders, selectedId, onSelect }: PosOrderListTableProps) {
  const { t } = useI18n();
  // Order totals are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();

  // px-2, not the table default: the middle column is only ~500px on a 1024px
  // tablet, and the six columns have to fit without a sideways scroll.
  const head = "h-10 px-2 text-xs";
  const cell = "px-2 py-1.5 text-xs";

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <Table className="min-w-[30rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={head}>{t("pos.queue.colOrder")}</TableHead>
            <TableHead className={head}>{t("pos.queue.colTime")}</TableHead>
            <TableHead className={cn(head, "text-center")}>{t("pos.queue.colQueue")}</TableHead>
            <TableHead className={head}>{t("pos.queue.colCustomer")}</TableHead>
            <TableHead className={head}>{t("pos.queue.colTable")}</TableHead>
            <TableHead className={cn(head, "text-right")}>{t("pos.queue.colTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const selected = order.id === selectedId;
            const table = order.tableLabel || order.tableNumber;
            return (
              <TableRow
                key={order.id}
                data-state={selected ? "selected" : undefined}
                aria-current={selected ? "true" : undefined}
                tabIndex={0}
                onClick={() => onSelect(order)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(order);
                  }
                }}
                // h-11 keeps every row at the ~44px touch target; `touch-manipulation`
                // because a <tr> isn't in the global clickable-selector list.
                className="h-11 cursor-pointer touch-manipulation"
              >
                <TableCell className={cell}>
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        getOrderStatusDotClass(order.status)
                      )}
                    />
                    <span className="sr-only">{mapOrderStatusLabel(t, order.status)}</span>
                    <span
                      className="font-mono font-medium whitespace-nowrap"
                      title={order.orderNumber}
                    >
                      {order.orderNumber}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(cell, "text-muted-foreground whitespace-nowrap tabular-nums")}
                >
                  {format(new Date(order.createdAt), "dd/MM HH:mm")}
                </TableCell>
                <TableCell className={cn(cell, "text-center text-sm font-bold tabular-nums")}>
                  {formatQueueNumber(order.queueNumber)}
                </TableCell>
                <TableCell className={cn(cell, "max-w-[7rem] truncate")} title={order.customerName}>
                  {order.customerName}
                </TableCell>
                <TableCell className={cn(cell, "max-w-[5rem] truncate")}>{table || "–"}</TableCell>
                <TableCell
                  className={cn(cell, "text-right font-medium whitespace-nowrap tabular-nums")}
                >
                  {formatPriceRaw(Number(order.total), currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
