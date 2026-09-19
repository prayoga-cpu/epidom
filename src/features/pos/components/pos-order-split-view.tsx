"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { LG_MIN_WIDTH_PX, useMinWidth } from "@/lib/hooks/use-min-width";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { QueueStatusFilter } from "../lib/order-queue-filters";
import type { PosOrderDisplay } from "../types/pos.types";
import { PosOrderStatusRail } from "./pos-order-status-rail";
import { PosOrderListTable } from "./pos-order-list-table";
import { PosOrderDetailPanel } from "./pos-order-detail-panel";

interface PosOrderSplitViewProps {
  /** Already filtered (source tab, search, status, …) and sorted. */
  orders: PosOrderDisplay[];
  storeId: string;
  statusCounts: Record<string, number>;
  statusFilter: QueueStatusFilter;
  onStatusFilterChange: (value: QueueStatusFilter) => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  /** Shown in the list column, in place of the table, when `orders` is empty. */
  emptyState?: ReactNode;
}

/**
 * Three columns — status rail | order list | selected order's details — from
 * `lg` up. Below that there's no room for three, so the rail becomes a chip row
 * above the list and the details open in a bottom sheet when a row is tapped.
 */
export function PosOrderSplitView({
  orders,
  storeId,
  statusCounts,
  statusFilter,
  onStatusFilterChange,
  onUpdateStatus,
  emptyState,
}: PosOrderSplitViewProps) {
  const { t } = useI18n();
  const isLg = useMinWidth(LG_MIN_WIDTH_PX);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Looked up in the VISIBLE list on purpose: an order that a tab, search or
  // status filter has just hidden is no longer selected, so the details never
  // describe a row the cashier can't see.
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[9rem_minmax(0,1fr)_19rem] xl:grid-cols-[11rem_minmax(0,1fr)_22rem]">
      <PosOrderStatusRail
        counts={statusCounts}
        value={statusFilter}
        onChange={onStatusFilterChange}
      />

      <div className="min-w-0">
        {orders.length === 0 ? (
          emptyState
        ) : (
          <PosOrderListTable
            orders={orders}
            selectedId={selected?.id ?? null}
            onSelect={(o) => setSelectedId(o.id)}
          />
        )}
      </div>

      {/* Docked column, lg+ only. Sticky so it stays beside a long list; the
          height cap keeps its own scrolling body (and pinned actions) inside the
          viewport — /app-zoom because CSS zoom on <html> doesn't scale dvh, and
          8rem for the status bar + tabs above the page content. Below lg it is
          display:none, and fed nothing so it doesn't mount a second live copy of
          the detail (its dialogs included) alongside the sheet's. */}
      <aside className="hidden lg:sticky lg:top-3 lg:block">
        <PosOrderDetailPanel
          order={isLg ? selected : null}
          storeId={storeId}
          onUpdateStatus={onUpdateStatus}
          className="lg:max-h-[calc(100dvh/var(--app-zoom,1)-8rem)]"
        />
      </aside>

      {/* Below lg there is no docked column; the same panel opens as a sheet. */}
      <Sheet
        open={!isLg && selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="shrink-0 border-b p-4 pr-14">
            <SheetTitle>{t("pos.queue.detailTitle")}</SheetTitle>
          </SheetHeader>
          <PosOrderDetailPanel
            order={selected}
            storeId={storeId}
            onUpdateStatus={onUpdateStatus}
            className="min-h-0 flex-1 rounded-none border-0"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
