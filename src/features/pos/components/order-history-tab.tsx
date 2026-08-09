"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { AGGREGATOR_LABELS } from "@/config/aggregator.config";
import {
  buildOrderHistoryParams,
  useDebouncedValue,
  useOrderHistory,
  useOrderPaymentTotals,
} from "../hooks/use-order-history";
import { usePosMenu } from "../hooks/use-pos-menu";
import { usePosStaffList } from "../hooks/use-pos-staff-list";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useUpdateOrderStatus } from "../hooks/use-update-order-status";
import { MarkPaidDialog, type MarkPaidConfirmData } from "./mark-paid-dialog";
import type { SettlePaymentMethod } from "../types/pos.types";
import {
  DATE_RANGE_PRESETS,
  resolveDateRangePreset,
  type DateRangePreset,
} from "../lib/date-range-presets";
import type { OrderHistoryFilters, OrderHistoryItem } from "../types/pos.types";
import { mapPaymentMethodLabel } from "../lib/order-status-display";
import { OrderHistoryDetailDialog } from "./order-history-detail-dialog";
import { UnpaidFilterToggle } from "./unpaid-filter-toggle";
import { AddFilterMenu } from "./add-filter-menu";
import { RemovableFilter } from "./removable-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DateRangeField } from "@/components/ui/date-range-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfirm } from "@/components/ui/use-confirm";
import { FileText, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "DELIVERED",
  "CANCELLED",
  "HELD",
] as const;

const DEPARTMENT_VALUES = ["ALL", "KITCHEN", "BAR"] as const;
const DATE_PRESET_VALUES: DateRangePreset[] = [...DATE_RANGE_PRESETS, "custom"];

// The optional filter dropdowns hidden by default behind "+ Add filter".
const HISTORY_FILTER_KEYS = [
  "status",
  "source",
  "department",
  "product",
  "staff",
  "paymentMethod",
  "dateRange",
] as const;
type HistoryFilterKey = (typeof HISTORY_FILTER_KEYS)[number];

const PAYMENT_METHOD_VALUES = [
  "CASH",
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "BANK_TRANSFER",
  "STRIPE_CARD",
  "PAY_LATER",
] as const;
const PAYMENT_METHOD_FILTER_VALUES = ["ALL", ...PAYMENT_METHOD_VALUES] as const;

interface HistoryFiltersState {
  status: string;
  source: string;
  from: string;
  to: string;
  datePreset: DateRangePreset;
  unpaidOnly: boolean;
  productId: string;
  department: string;
  staffId: string;
  paymentMethod: string;
  activeFilterKeys: HistoryFilterKey[];
}

const HISTORY_FILTERS_DEFAULTS: HistoryFiltersState = {
  status: "ALL",
  source: "ALL",
  from: "",
  to: "",
  datePreset: "all",
  unpaidOnly: false,
  productId: "ALL",
  department: "ALL",
  staffId: "ALL",
  paymentMethod: "ALL",
  activeFilterKeys: [],
};

// The reset applied to a filter's own value when it's removed from view —
// hiding a filter also clears it, so it can never keep narrowing results silently.
const HISTORY_FILTER_RESET: Record<HistoryFilterKey, Partial<HistoryFiltersState>> = {
  status: { status: "ALL" },
  source: { source: "ALL" },
  department: { department: "ALL" },
  product: { productId: "ALL" },
  staff: { staffId: "ALL" },
  paymentMethod: { paymentMethod: "ALL" },
  dateRange: { datePreset: "all", from: "", to: "" },
};

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeHistoryFilters(raw: unknown, defaults: HistoryFiltersState): HistoryFiltersState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<Record<keyof HistoryFiltersState, unknown>>;
  const activeFilterKeys = Array.isArray(r.activeFilterKeys)
    ? r.activeFilterKeys.filter((k): k is HistoryFilterKey =>
        (HISTORY_FILTER_KEYS as readonly string[]).includes(k)
      )
    : defaults.activeFilterKeys;
  return {
    status: typeof r.status === "string" ? r.status : defaults.status,
    source: typeof r.source === "string" ? r.source : defaults.source,
    from: typeof r.from === "string" ? r.from : defaults.from,
    to: typeof r.to === "string" ? r.to : defaults.to,
    datePreset: pick(r.datePreset, DATE_PRESET_VALUES, defaults.datePreset),
    unpaidOnly: typeof r.unpaidOnly === "boolean" ? r.unpaidOnly : defaults.unpaidOnly,
    productId: typeof r.productId === "string" ? r.productId : defaults.productId,
    department: pick(r.department, DEPARTMENT_VALUES, defaults.department),
    staffId: typeof r.staffId === "string" ? r.staffId : defaults.staffId,
    paymentMethod: pick(r.paymentMethod, PAYMENT_METHOD_FILTER_VALUES, defaults.paymentMethod),
    activeFilterKeys,
  };
}

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

function itemLine(item: OrderHistoryItem["items"][number]) {
  return `${Number(item.quantity)}x ${item.menuItem?.name ?? item.name}`;
}

interface OrderHistoryTabProps {
  storeId: string;
}

export function OrderHistoryTab({ storeId }: OrderHistoryTabProps) {
  const { t, formatDayDate, formatTimeOnly } = useI18n();
  // Order amounts are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrderHistoryItem | null>(null);

  const [filterState, setFilterState] = usePersistedState(
    `epidom-pos-history-filters-${storeId}`,
    HISTORY_FILTERS_DEFAULTS,
    sanitizeHistoryFilters
  );
  const {
    status,
    source,
    from,
    to,
    datePreset,
    unpaidOnly,
    productId,
    department,
    staffId,
    paymentMethod,
    activeFilterKeys,
  } = filterState;
  const patchFilters = (patch: Partial<HistoryFiltersState>) =>
    setFilterState((prev) => ({ ...prev, ...patch }));

  const addFilter = (key: HistoryFilterKey) => {
    if (activeFilterKeys.includes(key)) return;
    patchFilters({ activeFilterKeys: [...activeFilterKeys, key] });
  };

  const removeFilter = (key: HistoryFilterKey) => {
    setFilterState((prev) => ({
      ...prev,
      ...HISTORY_FILTER_RESET[key],
      activeFilterKeys: prev.activeFilterKeys.filter((k) => k !== key),
    }));
  };

  const { data: menuData } = usePosMenu(storeId);
  const productOptions = useMemo(() => {
    const items = menuData?.categories.flatMap((c) => c.items) ?? [];
    return items
      .map((i) => ({ id: i.id, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [menuData]);

  // Kept regardless of isActive — a past order can be tied to a
  // since-deactivated staff member, so the filter still needs to be able to
  // select them (labeled Inactive below), not just staff currently active.
  const { data: staffList } = usePosStaffList(storeId);
  const staffOptions = useMemo(
    () =>
      [...(staffList ?? [])].sort(
        (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
      ),
    [staffList]
  );

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === "custom") {
      patchFilters({ datePreset: preset });
      return;
    }
    const range = resolveDateRangePreset(preset);
    patchFilters({ datePreset: preset, from: range?.from ?? "", to: range?.to ?? "" });
  };

  const debouncedSearch = useDebouncedValue(search, 300);
  const filters: OrderHistoryFilters = {
    q: debouncedSearch,
    status,
    source,
    from,
    to,
    unpaidOnly,
    productId,
    department,
    staffId,
    paymentMethod,
  };

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useOrderHistory(
    storeId,
    filters
  );

  const orders = data?.pages.flatMap((p) => p.orders) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Deep link from the printer menu's "Reprint Last Order" panel
  // (?tab=history&order=<id>) — opens that order's detail dialog directly
  // instead of leaving the cashier to hunt for it in the table.
  const searchParams = useSearchParams();
  const targetOrderId = searchParams.get("order");
  const hasAutoOpenedRef = useRef(false);

  // A restrictive filter left over from a previous session (persisted via
  // usePersistedState) could hide the order we were just deep-linked to —
  // reset to defaults so it's actually findable in `orders` below.
  useEffect(() => {
    if (!targetOrderId) return;
    setFilterState(HISTORY_FILTERS_DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrderId]);

  useEffect(() => {
    if (!targetOrderId || hasAutoOpenedRef.current) return;
    const match = orders.find((o) => o.id === targetOrderId);
    if (match) {
      setSelected(match);
      hasAutoOpenedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrderId, orders]);

  // Same filters as the table above (paginated separately) — this reflects
  // the audit total for whatever date range/filters are currently applied,
  // not just the page of rows currently loaded on screen.
  const paymentTotals = useOrderPaymentTotals(storeId, filters);

  // --- Bulk selection & actions -------------------------------------------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkMarkPaid, setShowBulkMarkPaid] = useState(false);
  const updateStatus = useUpdateOrderStatus(storeId);
  const { confirm, confirmDialog: bulkConfirmDialog } = useConfirm();

  // A fresh query (any filter change) invalidates which rows are even on
  // screen — drop the selection rather than let it silently reference
  // orders the cashier can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    source,
    from,
    to,
    unpaidOnly,
    productId,
    department,
    staffId,
    paymentMethod,
    debouncedSearch,
  ]);

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const markPaidIds = selectedOrders.filter((o) => o.paymentStatus === "PENDING").map((o) => o.id);
  const cancelIds = selectedOrders.filter((o) => o.status !== "CANCELLED").map((o) => o.id);

  const toggleOrder = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(orders.map((o) => o.id)) : new Set());
  };

  async function runBulkUpdate(
    ids: string[],
    patch: {
      status?: string;
      paymentStatus?: "PAID";
      paymentMethod?: SettlePaymentMethod;
      paymentNote?: string;
    }
  ) {
    const results = await Promise.allSettled(
      ids.map((orderId) => updateStatus.mutateAsync({ orderId, ...patch }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    return { succeeded: ids.length - failed, failed };
  }

  function handleBulkMarkPaid() {
    if (markPaidIds.length === 0 || isBulkProcessing) return;
    setShowBulkMarkPaid(true);
  }

  async function handleConfirmBulkMarkPaid({ paymentMethod, paymentNote }: MarkPaidConfirmData) {
    setIsBulkProcessing(true);
    try {
      const { succeeded, failed } = await runBulkUpdate(markPaidIds, {
        paymentStatus: "PAID",
        paymentMethod,
        paymentNote,
      });
      if (failed === 0) {
        toast.success(t("pos.history.bulk.markPaidSuccess").replace("{n}", String(succeeded)));
      } else {
        toast.error(
          t("pos.history.bulk.partialFailure")
            .replace("{ok}", String(succeeded))
            .replace("{fail}", String(failed))
        );
      }
      setSelectedIds(new Set());
      setShowBulkMarkPaid(false);
    } finally {
      setIsBulkProcessing(false);
    }
  }

  async function handleBulkCancel() {
    if (cancelIds.length === 0 || isBulkProcessing) return;
    const ok = await confirm({
      title: t("pos.history.bulk.cancelConfirmTitle"),
      description: t("pos.history.bulk.cancelConfirmDesc").replace("{n}", String(cancelIds.length)),
      confirmText: t("pos.history.bulk.cancel"),
      variant: "destructive",
    });
    if (!ok) return;

    setIsBulkProcessing(true);
    try {
      const { succeeded, failed } = await runBulkUpdate(cancelIds, { status: "CANCELLED" });
      if (failed === 0) {
        toast.success(t("pos.history.bulk.cancelSuccess").replace("{n}", String(succeeded)));
      } else {
        toast.error(
          t("pos.history.bulk.partialFailure")
            .replace("{ok}", String(succeeded))
            .replace("{fail}", String(failed))
        );
      }
      setSelectedIds(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  }
  // -------------------------------------------------------------------------

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

  function openPrintReport() {
    const params = buildOrderHistoryParams(filters, 0);
    params.delete("take");
    window.open(`/store/${storeId}/pos/orders/print?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-4 p-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder={t("pos.history.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <UnpaidFilterToggle
          active={unpaidOnly}
          onToggle={() => patchFilters({ unpaidOnly: !unpaidOnly })}
        />
        {activeFilterKeys.includes("status") && (
          <RemovableFilter onRemove={() => removeFilter("status")}>
            <Select value={status} onValueChange={(v) => patchFilters({ status: v })}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("pos.history.allStatuses")}</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {mapStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("source") && (
          <RemovableFilter onRemove={() => removeFilter("source")}>
            <Select value={source} onValueChange={(v) => patchFilters({ source: v })}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("pos.history.allSources")}</SelectItem>
                <SelectItem value="MANUAL">{t("pos.history.sourceManual")}</SelectItem>
                <SelectItem value="STOREFRONT">{t("pos.history.sourceStorefront")}</SelectItem>
                <SelectItem value="POS">{t("pos.history.sourcePos")}</SelectItem>
                {Object.entries(AGGREGATOR_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("department") && (
          <RemovableFilter onRemove={() => removeFilter("department")}>
            <Select value={department} onValueChange={(v) => patchFilters({ department: v })}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.department")}</SelectItem>
                <SelectItem value="KITCHEN">{t("common.departmentKitchen")}</SelectItem>
                <SelectItem value="BAR">{t("common.departmentBar")}</SelectItem>
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("product") && productOptions.length > 0 && (
          <RemovableFilter onRemove={() => removeFilter("product")}>
            <Select value={productId} onValueChange={(v) => patchFilters({ productId: v })}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("pos.queue.filterAllProducts")}</SelectItem>
                {productOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("staff") && staffOptions.length > 0 && (
          <RemovableFilter onRemove={() => removeFilter("staff")}>
            <Select value={staffId} onValueChange={(v) => patchFilters({ staffId: v })}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("pos.queue.filterAllStaff")}</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {!s.isActive && (
                      <span className="text-muted-foreground"> ({t("pages.staffInactive")})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("paymentMethod") && (
          <RemovableFilter onRemove={() => removeFilter("paymentMethod")}>
            <Select value={paymentMethod} onValueChange={(v) => patchFilters({ paymentMethod: v })}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("pos.queue.filterAllPaymentMethods")}</SelectItem>
                {PAYMENT_METHOD_VALUES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {mapPaymentMethodLabel(t, m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("dateRange") && (
          <RemovableFilter onRemove={() => removeFilter("dateRange")}>
            <Select
              value={datePreset}
              onValueChange={(v) => handlePresetChange(v as DateRangePreset)}
            >
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {t(`pos.history.dateRange.${preset}`)}
                  </SelectItem>
                ))}
                <SelectItem value="custom">{t("pos.history.dateRange.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("dateRange") && datePreset === "custom" && (
          <DateRangeField
            id="history-date-range"
            from={from}
            to={to}
            presets={[]}
            className="w-full lg:w-64"
            onChange={(nextFrom, nextTo) => patchFilters({ from: nextFrom, to: nextTo })}
          />
        )}
        <AddFilterMenu
          options={HISTORY_FILTER_KEYS.filter((k) => !activeFilterKeys.includes(k)).map((k) => ({
            key: k,
            label: t(`pos.filters.${k}`),
          }))}
          onAdd={(k) => addFilter(k as HistoryFilterKey)}
        />
        <Button variant="outline" onClick={openPrintReport} className="h-9 shrink-0">
          <FileText className="mr-2 h-4 w-4" />
          {t("pos.history.exportPdf")}
        </Button>
      </div>

      {/* Payment method totals — audits "how much came in via each method"
          for whatever's currently filtered above, independent of Finance
          Reports access (see staff-permissions.config.ts). */}
      {!paymentTotals.isLoading &&
        !paymentTotals.isError &&
        (paymentTotals.data?.methods.length ?? 0) > 0 && (
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold uppercase">
                {t("pos.history.paymentTotalsTitle")}
              </span>
              <span className="text-sm font-semibold">
                {formatPrice(paymentTotals.data!.totalRevenue)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {paymentTotals.data!.methods.map((m) => (
                <div
                  key={m.paymentMethod}
                  className="bg-muted/30 flex min-w-[140px] flex-1 flex-col gap-0.5 rounded-md border px-3 py-2"
                >
                  <span className="text-muted-foreground text-xs">
                    {mapPaymentMethodLabel(t, m.paymentMethod)}
                  </span>
                  <span className="text-sm font-semibold">{formatPrice(m.revenue)}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("pos.history.paymentTotalsOrders").replace("{n}", String(m.orderCount))} ·{" "}
                    {m.percentOfTotal}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Bulk action bar — appears once at least one order is selected */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5">
          <span className="text-sm font-medium">
            {t("pos.history.bulk.selectedCount").replace("{n}", String(selectedIds.size))}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkMarkPaid}
              disabled={isBulkProcessing || markPaidIds.length === 0}
            >
              {isBulkProcessing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {t("pos.history.bulk.markPaid")}
              {markPaidIds.length > 0 && ` (${markPaidIds.length})`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleBulkCancel}
              disabled={isBulkProcessing || cancelIds.length === 0}
            >
              {t("pos.history.bulk.cancel")}
              {cancelIds.length > 0 && ` (${cancelIds.length})`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              disabled={isBulkProcessing}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("pos.history.bulk.clearSelection")}
            </Button>
          </div>
        </div>
      )}

      {/* Orders table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <h3 className="mb-1 font-semibold">{t("pos.history.empty")}</h3>
          <p className="text-muted-foreground text-sm">{t("pos.history.emptyDesc")}</p>
        </div>
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[1080px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={orders.length > 0 && selectedIds.size === orders.length}
                        onCheckedChange={(checked) => toggleAll(checked === true)}
                        aria-label={t("pos.history.bulk.selectAll")}
                      />
                    </TableHead>
                    <TableHead>{t("pos.history.colDate")}</TableHead>
                    <TableHead>{t("pos.history.colOrder")}</TableHead>
                    <TableHead>{t("pos.history.colSource")}</TableHead>
                    <TableHead>{t("pos.history.colType")}</TableHead>
                    <TableHead>{t("pos.history.colCustomer")}</TableHead>
                    <TableHead>{t("pos.history.colItems")}</TableHead>
                    <TableHead className="text-right">{t("pos.history.colTotal")}</TableHead>
                    <TableHead>{t("pos.history.colPaymentMethod")}</TableHead>
                    <TableHead>{t("pos.history.colPayment")}</TableHead>
                    <TableHead>{t("pos.history.colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(order)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={(checked) => toggleOrder(order.id, checked === true)}
                          aria-label={order.orderNumber}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {/* No year here — the exact date/year/timezone
                            lives in the order detail dialog instead. */}
                        <div>{formatDayDate(order.orderDate)}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatTimeOnly(order.orderDate)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{order.orderNumber}</TableCell>
                      <TableCell>
                        <Badge variant={getSourceBadgeVariant(order.source)}>
                          {mapSourceLabel(order.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>{mapTypeLabel(order.orderType)}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{order.customerName}</TableCell>
                      <TableCell className="max-w-64 truncate">
                        {order.items.slice(0, 2).map(itemLine).join(", ")}
                        {order.items.length > 2 && (
                          <span className="text-muted-foreground">
                            {" "}
                            {t("pos.history.moreItems").replace(
                              "{n}",
                              String(order.items.length - 2)
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPrice(Number(order.total))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {mapPaymentMethodLabel(t, order.paymentMethod)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                          {mapPaymentLabel(order.paymentStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {mapStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("pos.history.results").replace("{n}", String(totalCount))}
            </p>
            {hasNextPage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("pos.history.loadMore")}
              </Button>
            )}
          </div>
        </>
      )}

      <OrderHistoryDetailDialog
        order={selected}
        storeId={storeId}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
      {bulkConfirmDialog}
      <MarkPaidDialog
        open={showBulkMarkPaid}
        onOpenChange={setShowBulkMarkPaid}
        onConfirm={handleConfirmBulkMarkPaid}
        isSubmitting={isBulkProcessing}
        description={t("pos.history.bulk.markPaidConfirmDesc").replace(
          "{n}",
          String(markPaidIds.length)
        )}
      />
    </div>
  );
}
