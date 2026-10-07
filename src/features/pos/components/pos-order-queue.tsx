"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosStaffList } from "../hooks/use-pos-staff-list";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import { useKdsSettings } from "../hooks/use-kds-settings";
import { useCustomProductsSettings } from "@/features/dashboard/data/custom-products/hooks/use-custom-products-settings";
import type { OrderQueueState, QueueFiltersState } from "../hooks/use-order-queue-state";
import { PosOrderCard } from "./pos-order-card";
import { PosOrderRow } from "./pos-order-row";
import { PosOrderBoard } from "./pos-order-board";
import { PosOrderQueueToolbar } from "./pos-order-queue-toolbar";
import { PosOrderSplitView } from "./pos-order-split-view";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX, UtensilsCrossed, Power } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  matchesQueueFilters,
  sortQueueOrders,
  QUEUE_STATUSES,
  type QueueFilterKey,
} from "../lib/order-queue-filters";

interface PosOrderQueueProps {
  storeId: string;
  /**
   * The saved filters and the orders in scope — owned by the page shell
   * (PosOrdersTabs), whose top bar holds the POS / Online ordering tabs that
   * pick `filters.sourceFilter`. See useOrderQueueState.
   */
  queue: OrderQueueState;
}

// The reset applied to a filter's own value when it's removed from view —
// hiding a filter also clears it, so it can never keep narrowing results silently.
const QUEUE_FILTER_RESET: Record<QueueFilterKey, Partial<QueueFiltersState>> = {
  type: { typeFilter: "ALL" },
  department: { departmentFilter: "ALL" },
  product: { productFilter: "ALL" },
  staff: { staffFilter: "ALL" },
  paymentMethod: { paymentMethodFilter: "ALL" },
};

export function PosOrderQueue({ storeId, queue }: PosOrderQueueProps) {
  const { t } = useI18n();
  const { data: kdsSettings, isLoading: isLoadingSettings } = useKdsSettings(storeId);
  const { data: customProductsSettings } = useCustomProductsSettings(storeId);
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOrderStatus(storeId, { atTill: true });
  const activeQueueEnabled = kdsSettings?.kitchenDisplayEnabled ?? true;

  const { filters, setFilters, patchFilters, allOrders, scopedOrders, isLoading } = queue;
  const {
    view,
    statusFilter,
    sourceFilter,
    typeFilter,
    unpaidOnly,
    sortBy,
    productFilter,
    departmentFilter,
    staffFilter,
    paymentMethodFilter,
    activeFilterKeys,
  } = filters;
  // search is deliberately excluded from persistence — a stale free-text
  // query silently re-applied on the next visit would be more confusing
  // than helpful, unlike a toggle/dropdown choice.
  const [search, setSearch] = useState("");

  const addFilter = (key: QueueFilterKey) => {
    if (activeFilterKeys.includes(key)) return;
    patchFilters({ activeFilterKeys: [...activeFilterKeys, key] });
  };

  const removeFilter = (key: QueueFilterKey) => {
    setFilters((prev) => ({
      ...prev,
      ...QUEUE_FILTER_RESET[key],
      activeFilterKeys: prev.activeFilterKeys.filter((k) => k !== key),
    }));
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    // Optimistic update
    queryClient.setQueryData(["pos", "orders", storeId], (oldData: any[]) => {
      if (!oldData) return [];
      const updated = oldData.map((o) => (o.id === orderId ? { ...o, status } : o));
      // Cancelled orders leave the active queue outright. Delivered orders
      // leave too, unless payment is still pending — those stay visible for
      // follow-up (see ACTIVE_POS_QUEUE_FILTER on the server).
      if (status === "CANCELLED") {
        return updated.filter((o) => o.id !== orderId);
      }
      if (status === "DELIVERED") {
        return updated.filter((o) => o.id !== orderId || o.paymentStatus === "PENDING");
      }
      return updated;
    });

    try {
      await updateStatus.mutateAsync({ orderId, status });
    } catch (error) {
      toast.error(t("pos.queue.updateFailed"));
      // Revert will happen automatically on next SSE poll
    }
  };

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of scopedOrders) {
      for (const i of o.items) {
        if (i.menuItemId && !map.has(i.menuItemId)) {
          map.set(i.menuItemId, i.menuItem?.name ?? i.name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scopedOrders]);

  // isActive lookup only, so a since-deactivated staff member (still valid
  // to filter by — their past orders didn't disappear) can be labeled
  // Inactive instead of looking indistinguishable from current staff.
  const { data: staffRoster } = usePosStaffList(storeId);
  const staffOptions = useMemo(() => {
    const activeById = new Map((staffRoster ?? []).map((s) => [s.id, s.isActive]));
    const map = new Map<string, string>();
    for (const o of scopedOrders) {
      if (o.shift?.staffMember) map.set(o.shift.staffMember.id, o.shift.staffMember.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name, isActive: activeById.get(id) ?? true }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scopedOrders, staffRoster]);

  // Source/type/search filters apply everywhere; the status filter is a hard
  // filter in grid/compact views but only highlights a column in board view
  // (which keeps every status visible), so it's applied separately below.
  const preStatusOrders = useMemo(
    () =>
      scopedOrders.filter((o) =>
        matchesQueueFilters(o, {
          sourceFilter,
          typeFilter,
          search,
          unpaidOnly,
          productFilter,
          departmentFilter,
          staffFilter,
          paymentMethodFilter,
        })
      ),
    [
      scopedOrders,
      sourceFilter,
      typeFilter,
      search,
      unpaidOnly,
      productFilter,
      departmentFilter,
      staffFilter,
      paymentMethodFilter,
    ]
  );

  const unpaidCount = useMemo(
    () => scopedOrders.filter((o) => o.paymentStatus === "PENDING").length,
    [scopedOrders]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: preStatusOrders.length };
    for (const s of QUEUE_STATUSES) counts[s] = 0;
    for (const o of preStatusOrders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return counts;
  }, [preStatusOrders]);

  const visibleOrders = useMemo(() => {
    const filtered =
      statusFilter === "ALL"
        ? preStatusOrders
        : preStatusOrders.filter((o) => o.status === statusFilter);
    return sortQueueOrders(filtered, sortBy);
  }, [preStatusOrders, statusFilter, sortBy]);

  const boardOrders = useMemo(
    () => sortQueueOrders(preStatusOrders, sortBy),
    [preStatusOrders, sortBy]
  );

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    unpaidOnly ||
    productFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    staffFilter !== "ALL" ||
    paymentMethodFilter !== "ALL" ||
    search.trim().length > 0;

  const clearFilters = () => {
    setFilters((prev) => ({
      ...prev,
      statusFilter: "ALL",
      typeFilter: "ALL",
      unpaidOnly: false,
      productFilter: "ALL",
      departmentFilter: "ALL",
      staffFilter: "ALL",
      paymentMethodFilter: "ALL",
      activeFilterKeys: [],
    }));
    setSearch("");
  };

  if (isLoading || isLoadingSettings) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Active Queue is off — GET /pos/orders always reports empty in this mode
  // (see the API route), so this isn't the same as the queue merely having
  // no orders right now; explain why instead of the generic empty state.
  if (!activeQueueEnabled) {
    return (
      <div className="text-muted-foreground flex h-[calc(60dvh/var(--app-zoom,1))] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="bg-muted rounded-full p-6">
          <Power className="h-10 w-10 opacity-40" />
        </div>
        <p className="text-foreground text-lg font-medium">{t("pos.queue.activeQueueDisabledTitle")}</p>
        <p className="max-w-sm text-sm">{t("pos.queue.activeQueueDisabledDesc")}</p>
      </div>
    );
  }

  if (allOrders.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[calc(60dvh/var(--app-zoom,1))] flex-col items-center justify-center text-center">
        <div className="bg-muted mb-4 rounded-full p-6">
          <UtensilsCrossed className="h-10 w-10 opacity-50" />
        </div>
        <h3 className="text-foreground mb-2 text-xl font-semibold">{t("pos.queue.empty")}</h3>
        <p>{t("pos.queue.emptyDesc")}</p>
      </div>
    );
  }

  const noResults = view === "board" ? boardOrders.length === 0 : visibleOrders.length === 0;

  const noMatches = (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <SearchX className="h-8 w-8 opacity-50" />
      <p className="text-foreground font-medium">{t("pos.queue.noMatches")}</p>
      <p className="text-sm">{t("pos.queue.noMatchesDesc")}</p>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <PosOrderQueueToolbar
        statusCounts={statusCounts}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => patchFilters({ statusFilter: v })}
        showStatusTiles={view !== "split"}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => patchFilters({ typeFilter: v })}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(v) => patchFilters({ departmentFilter: v })}
        customDepartmentLabel={
          customProductsSettings?.customProductsEnabled
            ? customProductsSettings.customProductsLabel
            : null
        }
        productFilter={productFilter}
        onProductFilterChange={(v) => patchFilters({ productFilter: v })}
        productOptions={productOptions}
        staffFilter={staffFilter}
        onStaffFilterChange={(v) => patchFilters({ staffFilter: v })}
        staffOptions={staffOptions}
        paymentMethodFilter={paymentMethodFilter}
        onPaymentMethodFilterChange={(v) => patchFilters({ paymentMethodFilter: v })}
        activeFilterKeys={activeFilterKeys}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        unpaidOnly={unpaidOnly}
        onUnpaidOnlyChange={(v) => patchFilters({ unpaidOnly: v })}
        unpaidCount={unpaidCount}
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortByChange={(v) => patchFilters({ sortBy: v })}
        view={view}
        onViewChange={(v) => patchFilters({ view: v })}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        datePreset={queue.datePreset}
        defaultDatePreset={queue.defaultDatePreset}
        hasOpenShift={queue.hasOpenShift}
        onDatePresetChange={(v) => patchFilters({ datePreset: v })}
      />

      {view === "split" ? (
        // Rendered even with nothing to list: the rail has to stay so the cashier
        // can pick another status, and the source tabs above stay too. The
        // no-matches notice sits in the list column instead of replacing the view.
        <PosOrderSplitView
          orders={visibleOrders}
          storeId={storeId}
          statusCounts={statusCounts}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => patchFilters({ statusFilter: v })}
          onUpdateStatus={handleUpdateStatus}
          emptyState={noMatches}
        />
      ) : noResults ? (
        noMatches
      ) : view === "board" ? (
        <PosOrderBoard
          orders={boardOrders}
          storeId={storeId}
          onUpdateStatus={handleUpdateStatus}
          highlightedStatus={statusFilter}
        />
      ) : view === "compact" ? (
        <div className="flex flex-col gap-2">
          {visibleOrders.map((order) => (
            <PosOrderRow
              key={order.id}
              order={order}
              storeId={storeId}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      ) : (
        <div className="grid content-start items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleOrders.map((order) => (
            <PosOrderCard
              key={order.id}
              order={order}
              storeId={storeId}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
