"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosOrders } from "../hooks/use-pos-orders";
import { usePosStaffList } from "../hooks/use-pos-staff-list";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import { useKdsSettings } from "../hooks/use-kds-settings";
import { useTodayKey } from "../hooks/use-today-key";
import { useCustomProductsSettings } from "@/features/dashboard/data/custom-products/hooks/use-custom-products-settings";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { PosOrderCard } from "./pos-order-card";
import { PosOrderRow } from "./pos-order-row";
import { PosOrderBoard } from "./pos-order-board";
import { PosOrderQueueToolbar } from "./pos-order-queue-toolbar";
import { PosOrderSourceTabs } from "./pos-order-source-tabs";
import { PosOrderSplitView } from "./pos-order-split-view";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX, UtensilsCrossed, Power } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  countOrdersBySource,
  matchesQueueDate,
  matchesQueueFilters,
  sortQueueOrders,
  toSourceTab,
  DEFAULT_QUEUE_DATE_PRESET,
  QUEUE_DATE_PRESETS,
  QUEUE_STATUSES,
  QUEUE_FILTER_KEYS,
  QUEUE_PAYMENT_METHODS,
  type QueueDatePreset,
  type QueueDepartmentFilter,
  type QueueFilterKey,
  type QueuePaymentMethodFilter,
  type QueueSortBy,
  type QueueSourceTab,
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
  // The POS / Online tab. Never "All": a persisted "ALL" from before the tabs
  // existed is read as POS (see toSourceTab).
  sourceFilter: QueueSourceTab;
  typeFilter: QueueTypeFilter;
  unpaidOnly: boolean;
  sortBy: QueueSortBy;
  productFilter: string;
  departmentFilter: QueueDepartmentFilter;
  staffFilter: string;
  paymentMethodFilter: QueuePaymentMethodFilter;
  // Which orders the page is about, by the day they were placed (on the user's own
  // clock). Always applied and always shown — today unless changed. It is a PRESET,
  // never stored dates, so "today" can't go stale overnight.
  datePreset: QueueDatePreset;
  // Which of the optional filter dropdowns are currently shown — everything
  // except search/unpaid/date is hidden until the cashier explicitly adds it via
  // "+ Add filter", Notion-style, to keep the default toolbar uncluttered.
  activeFilterKeys: QueueFilterKey[];
  /** Shape of the saved state — see QUEUE_FILTERS_VERSION. */
  version: number;
}

/**
 * Bumped when the saved shape's meaning changes. 2 = the date defaults to TODAY
 * (there was no date filter before). usePersistedState can't tell a saved default
 * from a deliberate choice, so the version is how a state saved before the date
 * existed is told apart from one where the user picked "All time" on purpose.
 */
const QUEUE_FILTERS_VERSION = 2;

const QUEUE_FILTERS_DEFAULTS: QueueFiltersState = {
  view: "split",
  statusFilter: "ALL",
  sourceFilter: "POS",
  typeFilter: "ALL",
  unpaidOnly: false,
  sortBy: "newest",
  productFilter: "ALL",
  departmentFilter: "ALL",
  staffFilter: "ALL",
  paymentMethodFilter: "ALL",
  datePreset: DEFAULT_QUEUE_DATE_PRESET,
  activeFilterKeys: [],
  version: QUEUE_FILTERS_VERSION,
};

const VIEWS: QueueView[] = ["split", "grid", "compact", "board"];
const STATUS_FILTERS: QueueStatusFilter[] = ["ALL", ...QUEUE_STATUSES];
const TYPE_FILTERS: QueueTypeFilter[] = ["ALL", "DINE_IN", "TAKEAWAY", "DELIVERY"];
const SORT_BYS: QueueSortBy[] = ["newest", "oldest", "total-desc", "total-asc"];
const DEPARTMENT_FILTERS: QueueDepartmentFilter[] = ["ALL", "KITCHEN", "BAR", "CUSTOM"];
const PAYMENT_METHOD_FILTERS: QueuePaymentMethodFilter[] = ["ALL", ...QUEUE_PAYMENT_METHODS];

// The reset applied to a filter's own value when it's removed from view —
// hiding a filter also clears it, so it can never keep narrowing results silently.
const QUEUE_FILTER_RESET: Record<QueueFilterKey, Partial<QueueFiltersState>> = {
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
    sourceFilter: toSourceTab(r.sourceFilter),
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
    // Saved before the date existed: it takes the default (today) rather than
    // reading as "no date filter", so everyone gets the new default once.
    datePreset:
      r.version === QUEUE_FILTERS_VERSION
        ? pick(r.datePreset, QUEUE_DATE_PRESETS as QueueDatePreset[], defaults.datePreset)
        : defaults.datePreset,
    activeFilterKeys,
    version: QUEUE_FILTERS_VERSION,
  };
}

export function PosOrderQueue({ storeId }: PosOrderQueueProps) {
  const { t } = useI18n();
  const { data: orders, isLoading } = usePosOrders(storeId);
  const { data: kdsSettings, isLoading: isLoadingSettings } = useKdsSettings(storeId);
  const { data: customProductsSettings } = useCustomProductsSettings(storeId);
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOrderStatus(storeId);
  const activeQueueEnabled = kdsSettings?.kitchenDisplayEnabled ?? true;

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
  // The date goes to "All time" for the same reason: the unpaid alert counts every
  // unpaid order whatever day it is from, so a today-only list would show fewer
  // rows than the alert promised.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("unpaid") === "1") {
      setFilters((prev) => ({
        ...prev,
        unpaidOnly: true,
        statusFilter: "ALL",
        datePreset: "all",
      }));
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
    datePreset,
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

  // The orders this page is about: those placed inside the date scope (today by
  // default), on the user's own clock. Everything below — the list, the status
  // tiles, the POS / Online counts and the unpaid count — is built from THESE, so
  // no number on the page counts orders the list hides. todayKey re-runs it when
  // the local day changes, so a till left open past midnight rolls over by itself.
  const todayKey = useTodayKey();
  const scopedOrders = useMemo(
    () => allOrders.filter((o) => matchesQueueDate(o, datePreset)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allOrders, datePreset, todayKey]
  );

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

  // Badge counts on the POS / Online tabs: every open order in the date scope,
  // whatever the OTHER filters say — the tab is "how many are waiting there",
  // not "how many match". The date is the scope of the page rather than a filter
  // on it, so an order the list hides for being from another day isn't counted.
  const sourceCounts = useMemo(() => countOrdersBySource(scopedOrders), [scopedOrders]);

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
      <PosOrderSourceTabs
        value={sourceFilter}
        onChange={(v) => patchFilters({ sourceFilter: v })}
        counts={sourceCounts}
      />

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
        datePreset={datePreset}
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
