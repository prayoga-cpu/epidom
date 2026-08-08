"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosOrders } from "../hooks/use-pos-orders";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { PosOrderCard } from "./pos-order-card";
import { PosOrderRow } from "./pos-order-row";
import { PosOrderBoard } from "./pos-order-board";
import { PosOrderQueueToolbar } from "./pos-order-queue-toolbar";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX, UtensilsCrossed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  matchesQueueFilters,
  sortQueueOrders,
  QUEUE_STATUSES,
  QUEUE_FILTER_KEYS,
  QUEUE_PAYMENT_METHODS,
  type QueueDepartmentFilter,
  type QueueFilterKey,
  type QueuePaymentMethodFilter,
  type QueueSortBy,
  type QueueSourceFilter,
  type QueueStatusFilter,
  type QueueTypeFilter,
  type QueueView,
} from "../lib/order-queue-filters";
import type { PosOrderDisplay } from "../types/pos.types";

interface PosOrderQueueProps {
  storeId: string;
}

interface QueueFiltersState {
  view: QueueView;
  statusFilter: QueueStatusFilter;
  sourceFilter: QueueSourceFilter;
  typeFilter: QueueTypeFilter;
  unpaidOnly: boolean;
  sortBy: QueueSortBy;
  productFilter: string;
  departmentFilter: QueueDepartmentFilter;
  staffFilter: string;
  paymentMethodFilter: QueuePaymentMethodFilter;
  // Which of the optional filter dropdowns are currently shown — everything
  // except search/unpaid is hidden until the cashier explicitly adds it via
  // "+ Add filter", Notion-style, to keep the default toolbar uncluttered.
  activeFilterKeys: QueueFilterKey[];
}

const QUEUE_FILTERS_DEFAULTS: QueueFiltersState = {
  view: "grid",
  statusFilter: "ALL",
  sourceFilter: "ALL",
  typeFilter: "ALL",
  unpaidOnly: false,
  sortBy: "newest",
  productFilter: "ALL",
  departmentFilter: "ALL",
  staffFilter: "ALL",
  paymentMethodFilter: "ALL",
  activeFilterKeys: [],
};

const VIEWS: QueueView[] = ["grid", "compact", "board"];
const STATUS_FILTERS: QueueStatusFilter[] = ["ALL", ...QUEUE_STATUSES];
const SOURCE_FILTERS: QueueSourceFilter[] = ["ALL", "POS", "ONLINE"];
const TYPE_FILTERS: QueueTypeFilter[] = ["ALL", "DINE_IN", "TAKEAWAY", "DELIVERY"];
const SORT_BYS: QueueSortBy[] = ["newest", "oldest", "total-desc", "total-asc"];
const DEPARTMENT_FILTERS: QueueDepartmentFilter[] = ["ALL", "KITCHEN", "BAR"];
const PAYMENT_METHOD_FILTERS: QueuePaymentMethodFilter[] = ["ALL", ...QUEUE_PAYMENT_METHODS];

// The reset applied to a filter's own value when it's removed from view —
// hiding a filter also clears it, so it can never keep narrowing results silently.
const QUEUE_FILTER_RESET: Record<QueueFilterKey, Partial<QueueFiltersState>> = {
  source: { sourceFilter: "ALL" },
  type: { typeFilter: "ALL" },
  department: { departmentFilter: "ALL" },
  product: { productFilter: "ALL" },
  staff: { staffFilter: "ALL" },
  paymentMethod: { paymentMethodFilter: "ALL" },
};

function pick<T>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeQueueFilters(raw: unknown, defaults: QueueFiltersState): QueueFiltersState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<Record<keyof QueueFiltersState, unknown>>;
  const activeFilterKeys = Array.isArray(r.activeFilterKeys)
    ? r.activeFilterKeys.filter((k): k is QueueFilterKey =>
        (QUEUE_FILTER_KEYS as readonly string[]).includes(k)
      )
    : defaults.activeFilterKeys;
  return {
    view: pick(r.view, VIEWS, defaults.view),
    statusFilter: pick(r.statusFilter, STATUS_FILTERS, defaults.statusFilter),
    sourceFilter: pick(r.sourceFilter, SOURCE_FILTERS, defaults.sourceFilter),
    typeFilter: pick(r.typeFilter, TYPE_FILTERS, defaults.typeFilter),
    unpaidOnly: typeof r.unpaidOnly === "boolean" ? r.unpaidOnly : defaults.unpaidOnly,
    sortBy: pick(r.sortBy, SORT_BYS, defaults.sortBy),
    productFilter: typeof r.productFilter === "string" ? r.productFilter : defaults.productFilter,
    departmentFilter: pick(r.departmentFilter, DEPARTMENT_FILTERS, defaults.departmentFilter),
    staffFilter: typeof r.staffFilter === "string" ? r.staffFilter : defaults.staffFilter,
    paymentMethodFilter: pick(
      r.paymentMethodFilter,
      PAYMENT_METHOD_FILTERS,
      defaults.paymentMethodFilter
    ),
    activeFilterKeys,
  };
}

export function PosOrderQueue({ storeId }: PosOrderQueueProps) {
  const { t } = useI18n();
  const { data: orders, isLoading } = usePosOrders(storeId);
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOrderStatus(storeId);

  const [filters, setFilters] = usePersistedState(
    `epidom-pos-queue-filters-${storeId}`,
    QUEUE_FILTERS_DEFAULTS,
    sanitizeQueueFilters
  );

  // A ?unpaid=1 link (e.g. the POS unpaid-orders alert) should always win
  // over whatever filters were previously saved — runs after the persisted-
  // state load effect above (registered first, so it fires first on mount).
  // Forces statusFilter back to "ALL" too: unpaid orders can sit in any
  // status (Pending, Confirmed, Held, ...), so a stale non-ALL status tile
  // left selected from a prior visit would silently hide some of them.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("unpaid") === "1") {
      setFilters((prev) => ({ ...prev, unpaidOnly: true, statusFilter: "ALL" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const patchFilters = (patch: Partial<QueueFiltersState>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

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

  const allOrders = (orders ?? []) as PosOrderDisplay[];

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of allOrders) {
      for (const i of o.items) {
        if (i.menuItemId && !map.has(i.menuItemId)) {
          map.set(i.menuItemId, i.menuItem?.name ?? i.name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allOrders]);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of allOrders) {
      if (o.shift?.staffMember) map.set(o.shift.staffMember.id, o.shift.staffMember.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allOrders]);

  // Source/type/search filters apply everywhere; the status filter is a hard
  // filter in grid/compact views but only highlights a column in board view
  // (which keeps every status visible), so it's applied separately below.
  const preStatusOrders = useMemo(
    () =>
      allOrders.filter((o) =>
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
      allOrders,
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
    () => allOrders.filter((o) => o.paymentStatus === "PENDING").length,
    [allOrders]
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
    sourceFilter !== "ALL" ||
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
      sourceFilter: "ALL",
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

  if (isLoading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (allOrders.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="bg-muted mb-4 rounded-full p-6">
          <UtensilsCrossed className="h-10 w-10 opacity-50" />
        </div>
        <h3 className="text-foreground mb-2 text-xl font-semibold">{t("pos.queue.empty")}</h3>
        <p>{t("pos.queue.emptyDesc")}</p>
      </div>
    );
  }

  const noResults = view === "board" ? boardOrders.length === 0 : visibleOrders.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <PosOrderQueueToolbar
        statusCounts={statusCounts}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => patchFilters({ statusFilter: v })}
        sourceFilter={sourceFilter}
        onSourceFilterChange={(v) => patchFilters({ sourceFilter: v })}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => patchFilters({ typeFilter: v })}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(v) => patchFilters({ departmentFilter: v })}
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
      />

      {noResults ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <SearchX className="h-8 w-8 opacity-50" />
          <p className="text-foreground font-medium">{t("pos.queue.noMatches")}</p>
          <p className="text-sm">{t("pos.queue.noMatchesDesc")}</p>
        </div>
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
