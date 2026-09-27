"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { usePosOrders } from "./use-pos-orders";
import { useActiveShift } from "./use-active-shift";
import { useTodayKey } from "./use-today-key";
import {
  CURRENT_SHIFT_PRESET,
  defaultScopePreset,
  effectiveScopePreset,
} from "../lib/current-shift-scope";
import {
  countOrdersBySource,
  matchesQueueDate,
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

export interface QueueFiltersState {
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
  // Which orders the page is about, by when they were placed. Always applied and
  // always shown — the open till's shift (today with no till open) unless changed.
  // It is a PRESET, never stored dates or a shift id, so it can't go stale
  // overnight and follows whichever till is open.
  datePreset: QueueDatePreset;
  // Which of the optional filter dropdowns are currently shown — everything
  // except search/unpaid/date is hidden until the cashier explicitly adds it via
  // "+ Add filter", Notion-style, to keep the default toolbar uncluttered.
  activeFilterKeys: QueueFilterKey[];
  /** Shape of the saved state — see QUEUE_FILTERS_VERSION. */
  version: number;
}

/**
 * Bumped when the saved shape's meaning changes. usePersistedState can't tell a
 * saved default from a deliberate choice, so the version is how an old default
 * is told apart from a pick the user made on purpose.
 *   2 = the date defaults to TODAY (there was no date filter before).
 *   3 = the date defaults to the CURRENT SHIFT (today when no till is open).
 */
const QUEUE_FILTERS_VERSION = 3;

export const QUEUE_FILTERS_DEFAULTS: QueueFiltersState = {
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
const DATE_PRESET_VALUES: QueueDatePreset[] = [CURRENT_SHIFT_PRESET, ...QUEUE_DATE_PRESETS];

function pick<T>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * The saved date, read by the version it was saved at. A v2 "Today" is the old
 * default rather than a choice, so it takes the new one (the current shift); any
 * other v2 date was picked on purpose and stays. Before v2 there was no date.
 */
function savedDatePreset(
  r: Partial<Record<keyof QueueFiltersState, unknown>>,
  fallback: QueueDatePreset
): QueueDatePreset {
  if (r.version === QUEUE_FILTERS_VERSION) return pick(r.datePreset, DATE_PRESET_VALUES, fallback);
  if (r.version === 2 && r.datePreset !== "today") {
    return pick(r.datePreset, DATE_PRESET_VALUES, fallback);
  }
  return fallback;
}

export function sanitizeQueueFilters(raw: unknown, defaults: QueueFiltersState): QueueFiltersState {
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
    datePreset: savedDatePreset(r, defaults.datePreset),
    activeFilterKeys,
    version: QUEUE_FILTERS_VERSION,
  };
}

/**
 * The Order Queue's saved filters and the orders they scope to — owned by the
 * page shell (PosOrdersTabs) rather than the queue itself, because the POS /
 * Online ordering tabs and their counts sit in the page's top bar and stay up
 * while the Log (History) is open.
 */
export function useOrderQueueState(storeId: string) {
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
  // unpaid order whatever day it is from, so a shift- or today-only list would
  // show fewer rows than the alert promised.
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

  const patchFilters = (patch: Partial<QueueFiltersState>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const { data: orders, isLoading } = usePosOrders(storeId);
  const allOrders = useMemo(() => (orders ?? []) as PosOrderDisplay[], [orders]);

  // The store's open till, shared by every device (polled by useActiveShift).
  // Opening or closing one moves a "Current shift" page with it.
  const { shift: openShift } = useActiveShift(storeId);
  const hasOpenShift = openShift !== null;
  const shiftOpenedAt = openShift?.openedAt ?? null;
  const datePreset = effectiveScopePreset(filters.datePreset, hasOpenShift);

  // The orders this page is about: those placed inside the date scope (the open
  // shift, else today), on the user's own clock. Everything the queue shows — the
  // list, the status tiles, the POS / Online counts and the unpaid count — is
  // built from THESE, so no number on the page counts orders the list hides.
  // todayKey re-runs it when the local day changes, so a till left open past
  // midnight rolls over by itself.
  const todayKey = useTodayKey();
  const scopedOrders = useMemo(
    () => allOrders.filter((o) => matchesQueueDate(o, datePreset, new Date(), shiftOpenedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allOrders, datePreset, shiftOpenedAt, todayKey]
  );

  // Badge counts on the POS / Online tabs: every open order in the date scope,
  // whatever the OTHER filters say — the tab is "how many are waiting there",
  // not "how many match". The date is the scope of the page rather than a filter
  // on it, so an order the list hides for being out of scope isn't counted.
  const sourceCounts = useMemo(() => countOrdersBySource(scopedOrders), [scopedOrders]);

  return {
    filters,
    setFilters,
    patchFilters,
    /** The preset in force — "Current shift" reads as today with no till open. */
    datePreset,
    /** What the date opens on and resets to right now. */
    defaultDatePreset: defaultScopePreset(hasOpenShift),
    hasOpenShift,
    allOrders,
    scopedOrders,
    sourceCounts,
    isLoading,
  };
}

export type OrderQueueState = ReturnType<typeof useOrderQueueState>;
