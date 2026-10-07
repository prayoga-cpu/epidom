"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { apiClient } from "@/lib/api/client";
import { useCurrency } from "@/components/providers/currency-provider";
import { useCustomProductsSettings } from "@/features/dashboard/data/custom-products/hooks/use-custom-products-settings";
import { Download, FileText, Sheet, Pencil, Trash2 } from "lucide-react";
import { useSortable, sortRows } from "@/features/dashboard/shared/hooks/use-sortable";
import {
  SortableHead,
  ReportStatus,
  ReportStatusRow,
  TotalsCard,
  FilterScopeNote,
} from "./finance-report-parts";
import { FinancePnlStatement } from "./finance-pnl-statement";
import { FinanceExpensesTab } from "./finance-expenses-tab";
import { AdjustmentsTab, LabourTab, SalesPatternsTab, TaxTab } from "./finance-insight-tabs";
import { useFinanceExpenses } from "../hooks/use-finance-expenses";
import {
  adjustmentsQuery,
  labourQuery,
  salesPatternsQuery,
  taxQuery,
  type FinanceQueryScope,
} from "../finance-queries";
import type {
  CashReconciliationRow,
  CategoryRow,
  CategoryTotals,
  ChannelRow,
  DepartmentRow,
  ItemMarginRow,
  PaymentMethodRow,
  ScheduleShiftBucketRow,
  ScheduleShiftTotals,
  ShiftRow,
  SummaryData,
  TopItem,
  TopItemsTotals,
  WasteReasonRow,
} from "../finance-types";
import {
  averageTicket,
  buildPnlLines,
  classifyMenuItems,
  itemMarginTotals,
  scheduleBlockSubtotals,
  sharePct,
  sumColumns,
  topItemsBreakdown,
  type MenuClass,
} from "@/lib/finance/report-totals";
import { DateRangeField } from "@/components/ui/date-range-field";
import { PageIntro } from "@/features/guide/components/page-intro";
import {
  todayLocalISO,
  startOfMonthLocalISO,
  previousPeriodLocalISO,
} from "@/lib/utils/date-range";
import { Switch } from "@/components/ui/switch";
import { WasteFormDialog } from "@/features/dashboard/management/waste/waste-form-dialog";
import { mapPaymentMethodLabel } from "@/features/pos/lib/order-status-display";
import { useStoreShifts } from "@/features/pos/hooks/use-store-shifts";
import { formatShiftLabel, resolveShiftWindow } from "@/lib/finance/shift-window";
import { sumCashOnHand, type CashOnHandBreakdown } from "@/lib/finance/cash-drawer";
import { ONLINE_PLATFORM_SOURCES } from "@/config/aggregator.config";
import { orderSourceLabel } from "@/features/pos/lib/order-channel";
import {
  useWasteEntries,
  useDeleteWasteEntry,
  type WasteEntryWithRelations,
} from "@/features/dashboard/management/waste/hooks/use-waste";

interface StaffOption {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface FinanceClientProps {
  storeId: string;
  staff: StaffOption[];
  categories: CategoryOption[];
  /** The "This outlet / All outlets" switch, rendered in the header when the
   * viewer can see the roll-up — FinanceReport decides that, not this report. */
  scopeSwitch?: ReactNode;
}

const ALL = "all";

const CHANNEL_OPTIONS = ["MANUAL", "STOREFRONT", "POS", ...ONLINE_PLATFORM_SOURCES] as const;

// Excludes PAY_LATER — it describes a not-yet-settled order, not a way an
// order was actually paid, so it isn't a meaningful revenue filter bucket.
const PAYMENT_METHOD_OPTIONS = [
  "CASH",
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "BANK_TRANSFER",
  "STRIPE_CARD",
  "LINKAJA",
  "CHEQUE",
  "TITRE_RESTAURANT",
  "PAYPAL",
  "APPLE_PAY",
  "GOOGLE_PAY",
  "OTHER",
] as const;

/** One headline figure: label, value, optional period-over-period badge and
 * the context lines that explain it. */
function KpiCard({
  label,
  value,
  delta,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={`text-2xl font-bold tabular-nums ${valueClassName ?? ""}`}>{value}</p>
          {delta}
        </div>
        {sub && <div className="text-muted-foreground mt-0.5 space-y-0.5 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/** A phone-layout tab's loading or error state. */
function MobileStatus({ isError, onRetry }: { isError: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      <ReportStatus
        isError={isError}
        onRetry={onRetry}
        loadingLabel={t("common.loading")}
        errorLabel={t("pages.financeLoadError")}
        retryLabel={t("common.actions.retry")}
      />
    </div>
  );
}

/** A table body's "nothing in this period" row. */
function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useI18n();
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground py-8 text-center">
        {t("pages.noData")}
      </TableCell>
    </TableRow>
  );
}

/** One label/value line of a phone row card. */
function CardLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  tone?: "cost";
}) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${tone === "cost" ? "text-orange-600" : ""}`}>{value}</span>
    </div>
  );
}

type FilterKey = "staff" | "category" | "department" | "channel" | "paymentMethod";

const ORDER_FILTERS: FilterKey[] = ["staff", "channel", "paymentMethod"];

/**
 * Every report tab, in the order the tab bar shows them, with the page filters
 * each one applies. A tab says so when an active filter isn't one of its own
 * (FilterScopeNote), instead of silently showing unfiltered figures.
 */
const REPORT_TABS: { value: string; labelKey: string; filters: FilterKey[] }[] = [
  { value: "pl", labelKey: "pages.financePLStatement", filters: ORDER_FILTERS },
  { value: "daily", labelKey: "pages.financeDaily", filters: ORDER_FILTERS },
  { value: "expenses", labelKey: "pages.financeExpenses", filters: [] },
  { value: "channels", labelKey: "pages.financeChannels", filters: ["staff", "paymentMethod"] },
  { value: "paymentMethod", labelKey: "pages.financePaymentMethod", filters: ["staff", "channel"] },
  { value: "patterns", labelKey: "pages.financeSalesPatterns", filters: ORDER_FILTERS },
  {
    value: "items",
    labelKey: "pages.financeTopItems",
    filters: [...ORDER_FILTERS, "category", "department"],
  },
  {
    value: "margin",
    labelKey: "pages.financeItemMargin",
    filters: [...ORDER_FILTERS, "category", "department"],
  },
  { value: "category", labelKey: "pages.financeByCategory", filters: ORDER_FILTERS },
  { value: "adjustments", labelKey: "pages.financeAdjustments", filters: ORDER_FILTERS },
  { value: "tax", labelKey: "pages.financeTaxReport", filters: ORDER_FILTERS },
  { value: "waste", labelKey: "pages.financeWaste", filters: [] },
  { value: "cash", labelKey: "pages.financeCashReconciliation", filters: ["staff"] },
  { value: "shift", labelKey: "pages.financeByShift", filters: ["staff"] },
  { value: "scheduleShift", labelKey: "pages.financeScheduleShiftBlock", filters: [] },
  { value: "labour", labelKey: "pages.financeLabour", filters: [] },
];

const MENU_CLASS_STYLE: Record<MenuClass, string> = {
  star: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  plowhorse: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  puzzle: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  dog: "border-muted-foreground/30 text-muted-foreground",
};

/**
 * One label/value line inside a mobile cash-drawer card. The cash tab has far
 * more categories than fit as table columns on a phone, so the card shows only
 * the drivers a manager actually chases — and this keeps those lines aligned
 * (tabular figures, right-hand column) instead of ragged.
 */
/**
 * The discretionary cash categories, in formula order. Sales and the opening
 * float are always shown; these appear only when non-zero, so a store that
 * never takes a tip or drops to a safe doesn't read a column of zeros.
 *
 * `key` is checked against CashOnHandBreakdown by the row type, so adding a
 * category to the breakdown without listing it here is a type error rather
 * than a line that silently stops adding up.
 */
const CASH_CATEGORY_LINES: Array<{
  key: "cashRefunds" | "tips" | "pettyIn" | "pettyOut" | "drops" | "tipPayouts";
  labelKey: string;
}> = [
  { key: "cashRefunds", labelKey: "pages.financeCashRefunds" },
  { key: "tips", labelKey: "pages.financeCashTips" },
  { key: "pettyIn", labelKey: "pages.financeCashPettyIn" },
  { key: "pettyOut", labelKey: "pages.financeCashPettyOut" },
  { key: "drops", labelKey: "pages.financeCashDrops" },
  { key: "tipPayouts", labelKey: "pages.financeCashTipPayouts" },
];

function CashCardLine({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "total" | "variance";
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 text-sm ${
        emphasis ? "font-semibold" : ""
      } ${emphasis === "variance" ? "text-destructive" : ""}`}
    >
      <span className={emphasis === "variance" ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function FinanceClient({ storeId, staff, categories, scopeSwitch }: FinanceClientProps) {
  const { t, formatDateTime, formatDayDate, formatTimeOnly } = useI18n();
  // formatPrice(value): real IDR->owner-currency conversion (its default
  // behavior), for genuinely IDR-stored figures (waste-entry cost
  // snapshots below). formatOrderPrice: no-op passthrough, for
  // revenue/Order.total-derived figures (already literal in the owner's
  // currency, or pre-converted server-side by /finance/summary — see
  // storefront.service.ts's convertBaseToOwnerSync). Passing those to bare
  // formatPrice() would wrongly re-divide them by the IDR rate again.
  const { currency, formatPrice } = useCurrency();
  const formatOrderPrice = (value: number | null | undefined) => formatPrice(value, currency);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: customProductsSettings } = useCustomProductsSettings(storeId);
  const customDepartmentLabel = customProductsSettings?.customProductsEnabled
    ? customProductsSettings.customProductsLabel
    : null;
  const departmentLabel = (department: DepartmentRow["department"]) =>
    department === "KITCHEN"
      ? t("common.departmentKitchen")
      : department === "BAR"
        ? t("common.departmentBar")
        : department === "CUSTOM"
          ? (customDepartmentLabel ?? t("common.departmentUnassigned"))
          : t("common.departmentUnassigned");

  const [from, setFromState] = useState(searchParams.get("from") ?? startOfMonthLocalISO());
  const [to, setToState] = useState(searchParams.get("to") ?? todayLocalISO());
  const [staffId, setStaffIdState] = useState(searchParams.get("staffId") ?? ALL);
  // A till session (`Shift`). Like on Order History, it's a date-range
  // *preset*: picking one drives from/to to the session's open→close window as
  // full ISO datetimes. Every finance/* route already parses those params as
  // arbitrary ISO strings, so no route changes are needed — and the whole page
  // (KPI cards, P&L, every tab) narrows consistently instead of only the tabs
  // that happen to understand a shift.
  const [shiftId, setShiftIdState] = useState(searchParams.get("shiftId") ?? ALL);
  const [categoryId, setCategoryIdState] = useState(searchParams.get("category") ?? ALL);
  const [department, setDepartmentState] = useState(searchParams.get("department") ?? ALL);
  const [channel, setChannelState] = useState(searchParams.get("channel") ?? ALL);
  const [paymentMethod, setPaymentMethodState] = useState(searchParams.get("paymentMethod") ?? ALL);
  const [comparePrevious, setComparePreviousState] = useState(searchParams.get("compare") === "1");

  const [tab, setTabState] = useState(() => {
    const requested = searchParams.get("tab");
    return REPORT_TABS.some((r) => r.value === requested) ? (requested as string) : "pl";
  });

  const shifts = useStoreShifts(storeId);
  const queryClient = useQueryClient();

  // Reflects the current filter set into the URL — a filtered report view is
  // then shareable/bookmarkable and survives a refresh. Same pattern as
  // management-client.tsx's tab/highlight sync.
  const syncUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === ALL || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  const setDateRange = (nextFrom: string, nextTo: string) => {
    setFromState(nextFrom);
    setToState(nextTo);
    // Editing the date range by hand means the shift's window no longer
    // describes what's on screen — drop the selection rather than leave a
    // picker claiming a session it isn't showing.
    setShiftIdState(ALL);
    syncUrl({ from: nextFrom, to: nextTo, shiftId: null });
  };
  const setStaffId = (v: string) => {
    setStaffIdState(v);
    syncUrl({ staffId: v });
  };
  const setShiftId = (v: string) => {
    if (v === ALL) {
      // Restore a sane default range rather than leaving the report pinned to
      // a window whose explaining control has just been cleared.
      const nextFrom = startOfMonthLocalISO();
      const nextTo = todayLocalISO();
      setShiftIdState(ALL);
      setFromState(nextFrom);
      setToState(nextTo);
      syncUrl({ shiftId: null, from: nextFrom, to: nextTo });
      return;
    }
    const shift = (shifts.data ?? []).find((s) => s.id === v);
    if (!shift) return;
    // Not named `window` — this file calls the global window.open elsewhere,
    // and a shadowing local is a trap for the next edit.
    const shiftWindow = resolveShiftWindow(shift);
    const nextFrom = shiftWindow.from.toISOString();
    const nextTo = shiftWindow.to.toISOString();
    setShiftIdState(v);
    setFromState(nextFrom);
    setToState(nextTo);
    syncUrl({ shiftId: v, from: nextFrom, to: nextTo });
  };
  const setCategoryId = (v: string) => {
    setCategoryIdState(v);
    syncUrl({ category: v });
  };
  const setDepartment = (v: string) => {
    setDepartmentState(v);
    syncUrl({ department: v });
  };
  const setChannel = (v: string) => {
    setChannelState(v);
    syncUrl({ channel: v });
  };
  const setPaymentMethod = (v: string) => {
    setPaymentMethodState(v);
    syncUrl({ paymentMethod: v });
  };
  const setComparePrevious = (v: boolean) => {
    setComparePreviousState(v);
    syncUrl({ compare: v ? "1" : null });
  };
  // The open report rides in the URL too, so a refresh or a shared link lands
  // on the same tab.
  const setTab = (v: string) => {
    setTabState(v);
    syncUrl({ tab: v === "pl" ? null : v });
  };

  const channelLabel = (source: string) => orderSourceLabel(t, source);

  // This used to be a local switch that only covered CASH/QRIS/BANK_TRANSFER/
  // STRIPE_CARD, silently falling through to the raw enum string for GOPAY/
  // OVO/DANA/SHOPEEPAY/PAY_LATER — mapPaymentMethodLabel covers all 9 and
  // keeps this page's wording in sync with the POS queue/history views.
  const paymentMethodLabel = (method: string) => mapPaymentMethodLabel(t, method);

  // `from`/`to` normally hold a date-only YYYY-MM-DD, widened here to a whole
  // day. A shift selection instead stores a full ISO datetime (a till session
  // has minute precision) which must pass through untouched — otherwise
  // `...T00:00:00.000ZT00:00:00Z` reaches the server as garbage. Same guard as
  // buildOrderHistoryParams in use-order-history.ts.
  const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const rangeFrom = isDateOnly(from) ? `${from}T00:00:00Z` : from;
  const rangeTo = isDateOnly(to) ? `${to}T23:59:59Z` : to;
  const dateParams = `from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`;
  const staffParam = staffId !== ALL ? `&staffId=${staffId}` : "";
  const categoryParam = categoryId !== ALL ? `&category=${categoryId}` : "";
  const departmentParam = department !== ALL ? `&department=${department}` : "";
  const channelParam = channel !== ALL ? `&channel=${channel}` : "";
  const paymentMethodParam = paymentMethod !== ALL ? `&paymentMethod=${paymentMethod}` : "";
  const base = `/stores/${storeId}/finance`;

  const summary = useQuery({
    queryKey: ["finance-summary", storeId, from, to, staffId, channel, paymentMethod],
    queryFn: () =>
      apiClient.get<SummaryData>(
        `${base}/summary?${dateParams}${staffParam}${channelParam}${paymentMethodParam}`
      ),
  });

  // "Compare to previous period" — an equal-length preceding stretch (see
  // previousPeriodLocalISO), not calendar-last-month. Only fetched when the
  // toggle is on.
  const previousRange = useMemo(() => previousPeriodLocalISO(from, to), [from, to]);
  const previousDateParams = `from=${previousRange.from}T00:00:00Z&to=${previousRange.to}T23:59:59Z`;
  const summaryPrevious = useQuery({
    queryKey: [
      "finance-summary-previous",
      storeId,
      previousRange.from,
      previousRange.to,
      staffId,
      channel,
      paymentMethod,
    ],
    queryFn: () =>
      apiClient.get<SummaryData>(
        `${base}/summary?${previousDateParams}${staffParam}${channelParam}${paymentMethodParam}`
      ),
    // See the toggle below — a shift-scoped range has no meaningful
    // "previous equal-length period", and previousRange would be NaN.
    enabled: comparePrevious && shiftId === ALL,
  });

  const channels = useQuery({
    queryKey: ["finance-channels", storeId, from, to, staffId, paymentMethod],
    queryFn: () =>
      apiClient.get<{ channels: ChannelRow[] }>(
        `${base}/channels?${dateParams}${staffParam}${paymentMethodParam}`
      ),
  });

  const topItems = useQuery({
    queryKey: [
      "finance-top-items",
      storeId,
      from,
      to,
      staffId,
      categoryId,
      department,
      channel,
      paymentMethod,
    ],
    queryFn: () =>
      apiClient.get<{ items: TopItem[]; totals?: TopItemsTotals }>(
        `${base}/top-items?${dateParams}${staffParam}${categoryParam}${departmentParam}${channelParam}${paymentMethodParam}&limit=20&includeTotals=1`
      ),
  });

  const byCategory = useQuery({
    queryKey: ["finance-by-category", storeId, from, to, staffId, channel, paymentMethod],
    queryFn: () =>
      apiClient.get<{ categories: CategoryRow[]; totals?: CategoryTotals }>(
        `${base}/by-category?${dateParams}${staffParam}${channelParam}${paymentMethodParam}`
      ),
  });

  const byDepartment = useQuery({
    queryKey: ["finance-by-department", storeId, from, to, staffId, channel, paymentMethod],
    queryFn: () =>
      apiClient.get<{ departments: DepartmentRow[] }>(
        `${base}/by-department?${dateParams}${staffParam}${channelParam}${paymentMethodParam}`
      ),
  });

  const byShift = useQuery({
    queryKey: ["finance-by-shift", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ shifts: ShiftRow[] }>(`${base}/by-shift?${dateParams}${staffParam}`),
  });

  const byScheduleShift = useQuery({
    queryKey: ["finance-by-schedule-shift", storeId, from, to],
    queryFn: () =>
      apiClient.get<{ rows: ScheduleShiftBucketRow[]; totals?: ScheduleShiftTotals }>(
        `${base}/by-schedule-shift?${dateParams}`
      ),
  });

  const byPaymentMethod = useQuery({
    queryKey: ["finance-by-payment-method", storeId, from, to, staffId, channel],
    queryFn: () =>
      apiClient.get<{ methods: PaymentMethodRow[] }>(
        `${base}/by-payment-method?${dateParams}${staffParam}${channelParam}`
      ),
  });

  // Not scoped by channel/paymentMethod — a cash-drawer session isn't a
  // per-order concept.
  const cashReconciliation = useQuery({
    queryKey: ["finance-cash-reconciliation", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ shifts: CashReconciliationRow[] }>(
        `${base}/cash-reconciliation?${dateParams}${staffParam}`
      ),
  });

  const itemMargin = useQuery({
    queryKey: [
      "finance-item-margin",
      storeId,
      from,
      to,
      staffId,
      categoryId,
      department,
      channel,
      paymentMethod,
    ],
    queryFn: () =>
      apiClient.get<{ items: ItemMarginRow[] }>(
        `${base}/by-item-margin?${dateParams}${staffParam}${categoryParam}${departmentParam}${channelParam}${paymentMethodParam}`
      ),
  });

  // Waste has no shift/order linkage (v1) — not scoped by staffParam.
  const wasteByReason = useQuery({
    queryKey: ["finance-waste", storeId, from, to, "by-reason"],
    queryFn: () =>
      apiClient.get<{ reasons: WasteReasonRow[] }>(`${base}/by-waste-reason?${dateParams}`),
  });

  // rangeFrom/rangeTo, not `${from}T00:00:00Z`: with a till session picked,
  // from/to are already full datetimes and the suffix made the request invalid.
  const wasteEntries = useWasteEntries(storeId, {
    from: rangeFrom,
    to: rangeTo,
    take: 100,
  });

  const expenses = useFinanceExpenses(storeId, rangeFrom, rangeTo);

  // The tabs that load their own report (patterns, adjustments, tax, labour).
  // Expenses and labour belong to the whole store and to whole days. Set
  // against a figure narrowed by staff, channel, payment method or a till
  // session they'd compare unlike with unlike (all the rent against GoFood's
  // profit alone), so the lines that combine them only show unfiltered.
  const wholeStoreView =
    staffId === ALL && channel === ALL && paymentMethod === ALL && shiftId === ALL;

  const insightScope: FinanceQueryScope = {
    storeId,
    rangeFrom,
    rangeTo,
    staffId: staffId !== ALL ? staffId : null,
    channel: channel !== ALL ? channel : null,
    paymentMethod: paymentMethod !== ALL ? paymentMethod : null,
  };

  const deleteWasteEntry = useDeleteWasteEntry(storeId);
  const [wasteDialogOpen, setWasteDialogOpen] = useState(false);
  const [editingWasteEntry, setEditingWasteEntry] = useState<WasteEntryWithRelations | null>(null);
  const [wasteDeleteTarget, setWasteDeleteTarget] = useState<WasteEntryWithRelations | null>(null);

  // Client-side sort, mirroring the pattern in shifts-client.tsx — small
  // enough result sets (a date-range's worth of channels/items/categories/
  // shifts) that sorting the already-fetched rows in the browser is simpler
  // than adding server-side sort params.
  const channelSort = useSortable<"label" | "orderCount" | "revenue" | "netRevenue">("revenue");
  const sortedChannels = useMemo(
    () =>
      sortRows(channels.data?.channels ?? [], channelSort.sortDir, (c) => {
        if (channelSort.sortField === "label") return c.label;
        return c[channelSort.sortField];
      }),
    [channels.data, channelSort.sortField, channelSort.sortDir]
  );

  const itemSort = useSortable<"name" | "totalQuantity" | "totalRevenue">("totalRevenue");
  const sortedItems = useMemo(
    () =>
      sortRows(topItems.data?.items ?? [], itemSort.sortDir, (i) => {
        if (itemSort.sortField === "name") return i.name;
        return i[itemSort.sortField];
      }),
    [topItems.data, itemSort.sortField, itemSort.sortDir]
  );

  const categorySort = useSortable<"categoryName" | "totalQuantity" | "totalRevenue">(
    "totalRevenue"
  );
  const sortedCategories = useMemo(
    () =>
      sortRows(byCategory.data?.categories ?? [], categorySort.sortDir, (c) => {
        if (categorySort.sortField === "categoryName") return c.categoryName;
        return c[categorySort.sortField];
      }),
    [byCategory.data, categorySort.sortField, categorySort.sortDir]
  );

  const shiftSort = useSortable<"staffName" | "orderCount" | "revenue" | "openedAt">("revenue");
  const sortedShifts = useMemo(
    () =>
      sortRows(byShift.data?.shifts ?? [], shiftSort.sortDir, (s) => {
        if (shiftSort.sortField === "staffName") return s.staffName;
        if (shiftSort.sortField === "openedAt")
          return s.openedAt ? new Date(s.openedAt).getTime() : 0;
        return s[shiftSort.sortField];
      }),
    [byShift.data, shiftSort.sortField, shiftSort.sortDir]
  );

  const paymentMethodSort = useSortable<"paymentMethod" | "orderCount" | "revenue">("revenue");
  const sortedPaymentMethods = useMemo(
    () =>
      sortRows(byPaymentMethod.data?.methods ?? [], paymentMethodSort.sortDir, (m) => {
        if (paymentMethodSort.sortField === "paymentMethod") return m.paymentMethod;
        return m[paymentMethodSort.sortField];
      }),
    [byPaymentMethod.data, paymentMethodSort.sortField, paymentMethodSort.sortDir]
  );

  const cashSort = useSortable<"staffName" | "openedAt" | "cashDifference">("openedAt");
  const sortedCashRows = useMemo(
    () =>
      sortRows(cashReconciliation.data?.shifts ?? [], cashSort.sortDir, (row) => {
        if (cashSort.sortField === "staffName") return row.staffName;
        if (cashSort.sortField === "openedAt") return new Date(row.openedAt).getTime();
        return row.cashDifference ?? 0;
      }),
    [cashReconciliation.data, cashSort.sortField, cashSort.sortDir]
  );

  // Store-level position across every session listed. Same `sumCashOnHand`
  // the shift report and the dashboard card use, so the Finance total can't
  // drift from theirs — including its rule that a counted total (and therefore
  // a variance) only exists once EVERY till in the range has been counted.
  const cashTotals = useMemo(() => {
    const rows = cashReconciliation.data?.shifts ?? [];
    return rows.length ? sumCashOnHand(rows) : null;
  }, [cashReconciliation.data]);

  const marginSort = useSortable<"name" | "totalRevenue" | "margin" | "marginPct">("margin");
  const sortedMarginItems = useMemo(
    () =>
      sortRows(itemMargin.data?.items ?? [], marginSort.sortDir, (item) => {
        if (marginSort.sortField === "name") return item.name;
        // Unknown-margin items always sort last regardless of direction —
        // "unknown" isn't meaningfully greater or smaller than a real number.
        return item[marginSort.sortField] ?? -Infinity;
      }),
    [itemMargin.data, marginSort.sortField, marginSort.sortDir]
  );

  // ─── Totals and subtotals, one per table (see lib/finance/report-totals.ts —
  // the Excel export and the PDF use the same helpers). ───
  const channelTotals = sumColumns(channels.data?.channels ?? [], [
    "orderCount",
    "revenue",
    "refundAmount",
    "taxAmount",
    "commissionAmount",
    "processingFeeAmount",
    "netRevenue",
  ] as const);
  const paymentTotals = sumColumns(byPaymentMethod.data?.methods ?? [], [
    "orderCount",
    "revenue",
  ] as const);
  const itemsBreakdown = topItemsBreakdown(topItems.data?.items ?? [], topItems.data?.totals);
  const marginTotals = itemMarginTotals(itemMargin.data?.items ?? []);
  const menuClasses = useMemo(
    () => classifyMenuItems(itemMargin.data?.items ?? []),
    [itemMargin.data]
  );
  const categoryTotals = byCategory.data?.totals ?? null;
  const departmentTotals = sumColumns(byDepartment.data?.departments ?? [], [
    "totalQuantity",
    "totalRevenue",
  ] as const);
  const shiftTotals = sumColumns(byShift.data?.shifts ?? [], ["orderCount", "revenue"] as const);
  const blockSubtotals = useMemo(
    () => scheduleBlockSubtotals(byScheduleShift.data?.rows ?? []),
    [byScheduleShift.data]
  );
  const dailyTotals = sumColumns(summary.data?.buckets ?? [], [
    "orderCount",
    "revenue",
    "discountAmount",
    "refundAmount",
    "taxCollected",
    "netSales",
  ] as const);

  // Which active page filters a tab doesn't apply — see REPORT_TABS.
  const activeFilters: { key: FilterKey; label: string }[] = [
    { key: "staff" as const, label: t("pages.financeStaff"), on: staffId !== ALL },
    { key: "category" as const, label: t("pages.financeCategory"), on: categoryId !== ALL },
    { key: "department" as const, label: t("common.department"), on: department !== ALL },
    { key: "channel" as const, label: t("pages.financeChannel"), on: channel !== ALL },
    {
      key: "paymentMethod" as const,
      label: t("pages.financePaymentMethod"),
      on: paymentMethod !== ALL,
    },
  ]
    .filter((f) => f.on)
    .map(({ key, label }) => ({ key, label }));
  const ignoredFilters = (tabValue: string) => {
    const applies = REPORT_TABS.find((r) => r.value === tabValue)?.filters ?? [];
    return activeFilters.filter((f) => !applies.includes(f.key)).map((f) => f.label);
  };
  const scopeNote = (tabValue: string) => (
    <FilterScopeNote
      ignored={ignoredFilters(tabValue)}
      template={t("pages.financeFilterIgnored")}
    />
  );

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const used = new Set<string>();
    // Sheet names: at most 31 characters, no []:*?/\, and unique.
    const addSheet = (name: string, rows: (string | number | null)[][]) => {
      let sheetName = name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
      for (let n = 2; used.has(sheetName); n++) sheetName = `${sheetName.slice(0, 28)} ${n}`;
      used.add(sheetName);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
    };
    const total = t("pages.financeTotal");
    const pctOfNet = (value: number) =>
      summary.data && summary.data.netSales > 0 ? sharePct(value, summary.data.netSales) : "";

    if (summary.data) {
      const sd = summary.data;
      const expensesTotal = wholeStoreView ? (expenses.data?.total ?? null) : null;
      const rows: (string | number | null)[][] = [
        [t("pages.financePeriod"), `${from} — ${to}`, ""],
        ["", "", t("pages.financePctOfNetSales")],
        ...buildPnlLines(sd).map((line) => [t(line.labelKey), line.value, pctOfNet(line.value)]),
      ];
      if (expensesTotal != null) {
        rows.push([t("pages.financeOperatingExpenses"), -expensesTotal, pctOfNet(-expensesTotal)]);
        const after = Math.round((sd.netProfit - expensesTotal) * 100) / 100;
        rows.push([t("pages.financeProfitAfterExpenses"), after, pctOfNet(after)]);
      }
      rows.push(
        [],
        [t("pages.financeOrders"), sd.orderCount, ""],
        [t("pages.financeAvgTicket"), averageTicket(sd.revenue, sd.orderCount), ""],
        [t("pages.financeMargin"), `${sd.grossMarginPct}%`, ""],
        [t("pages.financeServiceCharge"), sd.serviceCharge, ""],
        [t("pages.financeDeliveryFees"), sd.deliveryFee, ""],
        [t("pages.financeAwaitingPayment"), sd.awaitingPaymentAmount, sd.awaitingPaymentCount]
      );
      addSheet(t("pages.financeSummarySheet"), rows);

      const days = sd.buckets;
      if (days.length) {
        addSheet(t("pages.financeDaily"), [
          [
            t("common.date"),
            t("pages.financeOrders"),
            t("pages.financeRevenue"),
            t("pages.financeDiscount"),
            t("pages.financeRefund"),
            t("pages.financeTax"),
            t("pages.financeNetSales"),
            t("pages.financeAvgTicket"),
          ],
          ...days.map((b) => [
            b.date,
            b.orderCount,
            b.revenue,
            b.discountAmount,
            b.refundAmount,
            b.taxCollected,
            b.netSales,
            averageTicket(b.revenue, b.orderCount),
          ]),
          [
            total,
            dailyTotals.orderCount,
            dailyTotals.revenue,
            dailyTotals.discountAmount,
            dailyTotals.refundAmount,
            dailyTotals.taxCollected,
            dailyTotals.netSales,
            averageTicket(dailyTotals.revenue, dailyTotals.orderCount),
          ],
        ]);
      }
    }

    if (expenses.data?.expenses.length) {
      addSheet(t("pages.financeExpenses"), [
        [
          t("common.date"),
          t("pages.financeCategory"),
          t("pages.financeDescription"),
          t("pages.financeAmount"),
        ],
        ...expenses.data.expenses.map((e) => [
          e.date,
          t(`pages.financeExpenseCategory.${e.category}`),
          e.description ?? "",
          e.amount,
        ]),
        [],
        ...expenses.data.byCategory.map((c) => [
          "",
          t(`pages.financeExpenseCategory.${c.category}`),
          `${c.count}`,
          c.amount,
        ]),
        [total, "", "", expenses.data.total],
      ]);
    }

    if (channels.data?.channels?.length) {
      addSheet(t("pages.financeChannels"), [
        [
          t("pages.financeChannel"),
          t("pages.financeOrders"),
          t("pages.financeRevenue"),
          t("pages.financeRefund"),
          t("pages.financeTax"),
          t("pages.financeCommission") + " (%)",
          t("pages.financeCommission"),
          t("pages.financeProcessingFee"),
          t("pages.financeNetRevenue"),
        ],
        ...channels.data.channels.map((c) => [
          c.label,
          c.orderCount,
          c.revenue,
          c.refundAmount,
          c.taxAmount,
          c.commissionPct,
          c.commissionAmount,
          c.processingFeeAmount,
          c.netRevenue,
        ]),
        [
          total,
          channelTotals.orderCount,
          channelTotals.revenue,
          channelTotals.refundAmount,
          channelTotals.taxAmount,
          "",
          channelTotals.commissionAmount,
          channelTotals.processingFeeAmount,
          channelTotals.netRevenue,
        ],
      ]);
    }

    if (byPaymentMethod.data?.methods?.length) {
      addSheet(t("pages.financePaymentMethod"), [
        [
          t("pages.financePaymentMethod"),
          t("pages.financePayments"),
          t("pages.financeRevenue"),
          "%",
        ],
        ...byPaymentMethod.data.methods.map((m) => [
          paymentMethodLabel(m.paymentMethod),
          m.orderCount,
          m.revenue,
          m.percentOfTotal,
        ]),
        [total, paymentTotals.orderCount, paymentTotals.revenue, 100],
      ]);
    }

    if (topItems.data?.items?.length) {
      const all = itemsBreakdown.all;
      const share = (value: number) => (all ? sharePct(value, all.totalRevenue) : "");
      const rows: (string | number | null)[][] = [
        [
          t("common.item"),
          t("pages.financeOrders"),
          t("pages.financeQtySold"),
          t("pages.financeRevenue"),
          t("pages.financeShare") + " (%)",
        ],
        ...topItems.data.items.map((i) => [
          i.name,
          i.orderCount,
          i.totalQuantity,
          i.totalRevenue,
          share(i.totalRevenue),
        ]),
        [
          t("pages.financeTopSubtotal").replace("{count}", String(itemsBreakdown.shown.itemCount)),
          "",
          itemsBreakdown.shown.totalQuantity,
          itemsBreakdown.shown.totalRevenue,
          share(itemsBreakdown.shown.totalRevenue),
        ],
      ];
      if (itemsBreakdown.other) {
        rows.push([
          t("pages.financeOtherItems").replace("{count}", String(itemsBreakdown.other.itemCount)),
          "",
          itemsBreakdown.other.totalQuantity,
          itemsBreakdown.other.totalRevenue,
          share(itemsBreakdown.other.totalRevenue),
        ]);
      }
      if (all)
        rows.push([t("pages.financeAllItems"), "", all.totalQuantity, all.totalRevenue, 100]);
      addSheet(t("pages.financeTopItems"), rows);
    }

    if (itemMargin.data?.items?.length) {
      const rows: (string | number | null)[][] = [
        [
          t("common.name"),
          t("pages.financeQtySold"),
          t("pages.financeRevenue"),
          t("pages.financeCost"),
          t("pages.financeMarginAmount"),
          t("pages.financeMargin"),
          t("pages.financeMenuClass"),
        ],
        ...itemMargin.data.items.map((i) => {
          const menuClass = menuClasses.get(i.name);
          return [
            i.name,
            i.totalQuantity,
            i.totalRevenue,
            i.totalCost ?? "—",
            i.margin ?? "—",
            i.marginPct != null ? `${i.marginPct}%` : "—",
            menuClass ? t(`pages.financeMenuClasses.${menuClass}`) : "",
          ];
        }),
        [
          t("pages.financeCostedTotal"),
          "",
          marginTotals.costedRevenue,
          marginTotals.totalCost,
          marginTotals.margin,
          `${marginTotals.marginPct}%`,
          "",
        ],
      ];
      if (marginTotals.uncostedCount > 0) {
        rows.push([
          t("pages.financeUncostedItems").replace("{count}", String(marginTotals.uncostedCount)),
          "",
          marginTotals.uncostedRevenue,
          "—",
          "—",
          "—",
          "",
        ]);
      }
      addSheet(t("pages.financeItemMargin"), rows);
    }

    if (byCategory.data?.categories?.length) {
      const itemsSubtotal = categoryTotals?.totalRevenue ?? 0;
      const rows: (string | number | null)[][] = [
        [
          t("pages.financeCategory"),
          t("pages.financeOrders"),
          t("pages.financeQtySold"),
          t("pages.financeRevenue"),
          t("pages.financeShare") + " (%)",
        ],
        ...byCategory.data.categories.map((c) => [
          c.categoryId ? c.categoryName : t("pages.financeUncategorized"),
          c.orderCount,
          c.totalQuantity,
          c.totalRevenue,
          sharePct(c.totalRevenue, itemsSubtotal),
        ]),
      ];
      if (categoryTotals) {
        rows.push([
          t("pages.financeItemsSubtotal"),
          categoryTotals.orderCount,
          categoryTotals.totalQuantity,
          categoryTotals.totalRevenue,
          100,
        ]);
        if (summary.data) {
          rows.push(
            [
              t("pages.financeOrderAdjustments"),
              "",
              "",
              Math.round((summary.data.revenue - itemsSubtotal) * 100) / 100,
              "",
            ],
            [t("pages.financeRevenue"), summary.data.orderCount, "", summary.data.revenue, ""]
          );
        }
      }
      addSheet(t("pages.financeByCategory"), rows);
    }

    if (byDepartment.data?.departments?.length) {
      addSheet(t("pages.financeDepartmentSplit"), [
        [
          t("common.department"),
          t("pages.financeQtySold"),
          t("pages.financeRevenue"),
          t("pages.financeShare") + " (%)",
        ],
        ...byDepartment.data.departments.map((d) => [
          departmentLabel(d.department),
          d.totalQuantity,
          d.totalRevenue,
          sharePct(d.totalRevenue, departmentTotals.totalRevenue),
        ]),
        [
          t("pages.financeItemsSubtotal"),
          departmentTotals.totalQuantity,
          departmentTotals.totalRevenue,
          100,
        ],
      ]);
    }

    if (byShift.data?.shifts?.length) {
      addSheet(t("pages.financeByShift"), [
        [
          t("pages.financeCashier"),
          t("pages.financeShiftPeriod"),
          t("pages.financeOrders"),
          t("pages.financeRevenue"),
          t("pages.financeAvgTicket"),
        ],
        ...byShift.data.shifts.map((sh) => [
          sh.shiftId ? sh.staffName : t("pages.financeUnassigned"),
          sh.openedAt
            ? `${formatDateTime(sh.openedAt)} — ${sh.closedAt ? formatDateTime(sh.closedAt) : "—"}`
            : "—",
          sh.orderCount,
          sh.revenue,
          averageTicket(sh.revenue, sh.orderCount),
        ]),
        [
          total,
          "",
          shiftTotals.orderCount,
          shiftTotals.revenue,
          averageTicket(shiftTotals.revenue, shiftTotals.orderCount),
        ],
      ]);
    }

    if (byScheduleShift.data?.rows?.length) {
      const totals = byScheduleShift.data.totals;
      const rows: (string | number | null)[][] = [
        [
          t("pages.financeScheduleShiftBlock"),
          t("pages.financeActiveDays"),
          t("pages.financeOrders"),
          t("pages.financeRevenue"),
        ],
        ...blockSubtotals.map((b) => [b.name, b.activeDays, b.orderCount, b.revenue]),
      ];
      if (totals) {
        rows.push(
          [t("pages.financeOutsideBlocks"), "", totals.outsideOrderCount, totals.outsideRevenue],
          [t("pages.financeAllOrdersOnce"), "", totals.orderCount, totals.revenue]
        );
      }
      rows.push(
        [],
        [
          t("pages.financeScheduleShiftBlock"),
          t("common.date"),
          t("pages.financeOrders"),
          t("pages.financeRevenue"),
          t("pages.financeStaffOnDuty"),
        ],
        ...byScheduleShift.data.rows
          .filter((r) => r.orderCount > 0)
          .map((r) => [
            r.name,
            r.date,
            r.orderCount,
            r.revenue,
            r.staffOnDuty.map((member) => member.name).join(", "),
          ])
      );
      addSheet(t("pages.financeScheduleShiftBlock"), rows);
    }

    if (cashReconciliation.data?.shifts?.length) {
      // Same column order as the on-screen table, so the sheet reads as the
      // drawer's arithmetic left-to-right: float in, what moved, what should
      // be there, what was counted, the gap.
      const cashCells = (row: CashOnHandBreakdown) => [
        row.openingCash,
        row.cashSales,
        row.cashRefunds,
        row.tips,
        row.pettyIn,
        row.pettyOut,
        row.drops,
        row.tipPayouts,
        row.expectedCash,
        row.closingCash ?? "—",
        row.cashDifference ?? "—",
      ];
      const rows: (string | number | null)[][] = cashReconciliation.data.shifts.map((row) => [
        row.staffName,
        `${formatDateTime(row.openedAt)}${row.closedAt ? ` — ${formatDateTime(row.closedAt)}` : ""}`,
        ...cashCells(row),
      ]);
      if (cashTotals) rows.push([t("pages.financeCashTotals"), "", ...cashCells(cashTotals)]);
      addSheet(t("pages.financeCashReconciliation"), [
        [
          t("pages.financeCashier"),
          t("pages.financeShiftPeriod"),
          t("pages.financeOpeningCash"),
          t("pages.financeCashSales"),
          t("pages.financeCashRefunds"),
          t("pages.financeCashTips"),
          t("pages.financeCashPettyIn"),
          t("pages.financeCashPettyOut"),
          t("pages.financeCashDrops"),
          t("pages.financeCashTipPayouts"),
          t("pages.financeExpectedCash"),
          t("pages.financeClosingCash"),
          t("pages.financeCashDifference"),
        ],
        ...rows,
      ]);
    }

    if (wasteEntries.data?.entries?.length) {
      addSheet(t("pages.financeWaste") || "Waste", [
        [
          t("waste.table.date") || "Date",
          t("waste.table.item") || "Item",
          t("waste.table.reason") || "Reason",
          t("waste.table.quantity") || "Quantity",
          t("waste.table.unitCost") || "Unit cost",
          t("waste.table.totalValue") || "Total value",
          t("waste.table.notes") || "Notes",
        ],
        ...wasteEntries.data.entries.map((entry) => [
          formatDateTime(entry.createdAt),
          entry.material?.name ?? entry.product?.name ?? "—",
          entry.reason === "OTHER" ? (entry.customReason ?? entry.reason) : entry.reason,
          Number(entry.quantity),
          Number(entry.unitCostSnapshot),
          Number(entry.totalValue),
          entry.notes ?? "",
        ]),
        [
          total,
          `${wasteEntries.data.entries.length} / ${wasteEntries.data.total}`,
          "",
          "",
          "",
          wasteEntries.data.sumValue,
          "",
        ],
      ]);
    }

    // The tabs that load on their own: reuse what's cached, fetch what isn't.
    // A sheet the viewer may not see (Labour is manager-only) is left out.
    const fetchOrNull = async <T,>(options: { queryKey: unknown[]; queryFn: () => Promise<T> }) => {
      try {
        return await queryClient.fetchQuery(options);
      } catch {
        return null;
      }
    };
    const [patterns, adjustments, tax, labour] = await Promise.all([
      fetchOrNull(salesPatternsQuery(insightScope)),
      fetchOrNull(adjustmentsQuery(insightScope)),
      fetchOrNull(taxQuery(insightScope)),
      fetchOrNull(labourQuery(insightScope)),
    ]);

    if (patterns?.byOrderType.length) {
      const typeTotals = sumColumns(patterns.byOrderType, [
        "orderCount",
        "revenue",
        "guests",
      ] as const);
      addSheet(t("pages.financeSalesPatterns"), [
        [
          t("pages.financeOrderType"),
          t("pages.financeOrders"),
          t("pages.financeRevenue"),
          t("pages.financeAvgTicket"),
          t("pages.financeGuests"),
        ],
        ...patterns.byOrderType.map((r) => [
          r.orderType,
          r.orderCount,
          r.revenue,
          averageTicket(r.revenue, r.orderCount),
          r.guests,
        ]),
        [
          total,
          typeTotals.orderCount,
          typeTotals.revenue,
          averageTicket(typeTotals.revenue, typeTotals.orderCount),
          typeTotals.guests,
        ],
        [],
        [t("pages.financeHour"), t("pages.financeOrders"), t("pages.financeRevenue")],
        ...patterns.byHour
          .filter((h) => h.orderCount > 0)
          .map((h) => [`${String(h.hour).padStart(2, "0")}:00`, h.orderCount, h.revenue]),
      ]);
    }

    if (adjustments) {
      const reasonRows = (rows: typeof adjustments.discounts) =>
        rows.map((r) => [
          r.isCoupon
            ? `${t("pages.financeCoupon")} ${r.label}`
            : (r.label ?? t("pages.financeNoReason")),
          r.orderCount,
          r.amount,
        ]);
      const discountTotals = sumColumns(adjustments.discounts, ["orderCount", "amount"] as const);
      const refundTotals = sumColumns(adjustments.refunds, ["orderCount", "amount"] as const);
      addSheet(t("pages.financeAdjustments"), [
        [t("pages.financeDiscountsByReason"), t("pages.financeOrders"), t("pages.financeAmount")],
        ...reasonRows(adjustments.discounts),
        [total, discountTotals.orderCount, discountTotals.amount],
        [],
        [t("pages.financeRefundsByReason"), t("pages.financeOrders"), t("pages.financeAmount")],
        ...reasonRows(adjustments.refunds),
        [total, refundTotals.orderCount, refundTotals.amount],
        [],
        [
          t("pages.financeCancelledOrders"),
          adjustments.cancelled.orderCount,
          adjustments.cancelled.value,
        ],
        [t("pages.financeVoidedItems"), adjustments.voids.lineCount, adjustments.voids.value],
      ]);
    }

    if (tax?.rates.length) {
      const taxTotals = sumColumns(tax.rates, [
        "orderCount",
        "taxableBase",
        "taxCharged",
        "refundedTax",
        "taxOwed",
      ] as const);
      addSheet(t("pages.financeTaxReport"), [
        [
          t("pages.financeTaxRate"),
          t("pages.financeOrders"),
          t("pages.financeTaxableBase"),
          t("pages.financeTaxCharged"),
          t("pages.financeTaxRefunded"),
          t("pages.financeTaxOwed"),
        ],
        ...tax.rates.map((r) => [
          `${r.ratePct}%`,
          r.orderCount,
          r.taxableBase,
          r.taxCharged,
          r.refundedTax,
          r.taxOwed,
        ]),
        [
          total,
          taxTotals.orderCount,
          taxTotals.taxableBase,
          taxTotals.taxCharged,
          taxTotals.refundedTax,
          taxTotals.taxOwed,
        ],
      ]);
    }

    if (labour?.rows.length) {
      addSheet(t("pages.financeLabour"), [
        [
          t("pages.financeStaff"),
          t("pages.staffPayType"),
          t("pages.staffPayRate"),
          t("pages.financeHoursWorked"),
          t("pages.financeDaysWorked"),
          t("pages.financeLabourCost"),
        ],
        ...labour.rows.map((r) => [
          r.name,
          r.payType,
          r.payRate ?? "",
          Math.round((r.workedMinutes / 60) * 100) / 100,
          r.workedDays,
          r.cost ?? "—",
        ]),
        [
          total,
          "",
          "",
          Math.round((labour.totals.workedMinutes / 60) * 100) / 100,
          "",
          labour.totals.cost,
        ],
      ]);
    }

    XLSX.writeFile(wb, `finance-report-${from}-${to}.xlsx`);
  }

  function openPrintView() {
    // Every filter the screen applies, so the PDF is the report on screen. A
    // till session goes as its exact window; the print page widens a bare date
    // to the whole day itself.
    const params = new URLSearchParams({ from, to });
    if (staffId !== ALL) params.set("staffId", staffId);
    if (categoryId !== ALL) params.set("category", categoryId);
    if (department !== ALL) params.set("department", department);
    if (channel !== ALL) params.set("channel", channel);
    if (paymentMethod !== ALL) params.set("paymentMethod", paymentMethod);
    window.open(`/store/${storeId}/finance/print?${params.toString()}`, "_blank");
  }

  const handleEditWaste = (entry: WasteEntryWithRelations) => {
    setEditingWasteEntry(entry);
    setWasteDialogOpen(true);
  };

  const handleDeleteWasteConfirm = async () => {
    if (!wasteDeleteTarget) return;
    try {
      await deleteWasteEntry.mutateAsync(wasteDeleteTarget.id);
      setWasteDeleteTarget(null);
    } catch {
      // Error surfaced via the mutation's own state; keep the dialog open so
      // the user can retry rather than silently losing their delete intent.
    }
  };

  const s = summary.data;
  // Matches summaryPrevious's own `enabled` — with a shift selected there is
  // no previous period, so the delta badges must not render stale data from
  // before the selection.
  const sPrev = comparePrevious && shiftId === ALL ? summaryPrevious.data : undefined;

  /** % change vs. the previous-period value, or null if there's nothing to compare against. */
  const deltaPct = (key: keyof SummaryData) => {
    if (!s || !sPrev) return null;
    const current = Number(s[key] ?? 0);
    const previous = Number(sPrev[key] ?? 0);
    if (previous === 0) return current === 0 ? 0 : null; // avoid a misleading "∞%"
    return Math.round(((current - previous) / previous) * 1000) / 10;
  };

  const DeltaBadge = ({ metricKey }: { metricKey: keyof SummaryData }) => {
    const pct = deltaPct(metricKey);
    if (pct === null) return null;
    const isUp = pct > 0;
    const isFlat = pct === 0;
    return (
      <span
        className={
          isFlat
            ? "text-muted-foreground text-xs"
            : isUp
              ? "text-xs text-emerald-600"
              : "text-xs text-red-600"
        }
      >
        {isFlat ? "±0%" : `${isUp ? "+" : ""}${pct}%`}
      </span>
    );
  };

  return (
    <div className="min-h-[calc((100vh-150px)/var(--app-zoom,1))] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pages.financeTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pages.financeDesc")}</p>
        </div>
        {/* Not shrink-0: with the scope switch here the cluster must be able to
            wrap under a long title (French) instead of squeezing it. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {scopeSwitch}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-10 shrink-0">
                <Download className="mr-2 h-4 w-4" />
                {t("common.actions.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openPrintView}>
                <FileText className="mr-2 h-4 w-4" />
                {t("common.actions.exportAsPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportXlsx}>
                <Sheet className="mr-2 h-4 w-4" />
                {t("common.actions.exportAsExcel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PageIntro id="finance" storeId={storeId} />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="finance-date-range">{t("common.datePicker.dateRange")}</Label>
          {/* While a shift drives the range, from/to hold full ISO datetimes
              that a <input type="date"> can't represent — show the resolved
              window as read-only text instead of feeding it a value it would
              silently mangle. Clearing the shift restores the picker. */}
          {shiftId === ALL ? (
            <DateRangeField
              id="finance-date-range"
              from={from}
              to={to}
              onChange={(nextFrom, nextTo) => setDateRange(nextFrom, nextTo)}
            />
          ) : (
            <div className="bg-muted/30 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-xs">
              {formatDateTime(from)} — {formatDateTime(to)}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label>{t("pages.financeShiftSession")}</Label>
          <Select value={shiftId} onValueChange={setShiftId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={t("filters.allShifts")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allShifts")}</SelectItem>
              {(shifts.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {formatShiftLabel(s, {
                    formatDayDate,
                    formatTimeOnly,
                    openLabel: t("pos.history.shiftStillOpen"),
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("pages.financeStaff")}</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allStaff")}</SelectItem>
              {staff.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {!m.isActive && (
                    <span className="text-muted-foreground"> ({t("pages.staffInactive")})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("pages.financeCategory")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allCategories")}</SelectItem>
              <SelectItem value="none">{t("pages.financeUncategorized")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("common.department")}</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allDepartments")}</SelectItem>
              <SelectItem value="none">{t("common.departmentUnassigned")}</SelectItem>
              <SelectItem value="KITCHEN">{t("common.departmentKitchen")}</SelectItem>
              <SelectItem value="BAR">{t("common.departmentBar")}</SelectItem>
              {/* "CUSTOM" = report-filters' CUSTOM_DEPARTMENT (not imported:
                  that module pulls in @prisma/client). */}
              {customDepartmentLabel && (
                <SelectItem value="CUSTOM">{customDepartmentLabel}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("pages.financeChannel")}</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allChannels")}</SelectItem>
              {CHANNEL_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {channelLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("pages.financePaymentMethod")}</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allPaymentMethods")}</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {paymentMethodLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Unavailable while a shift is selected: previousPeriodLocalISO
            works in whole local days off a YYYY-MM-DD pair, and "the equal
            length stretch before this till session" isn't a meaningful
            comparison anyway. Hidden rather than silently producing a NaN
            range. */}
        {shiftId === ALL && (
          <div className="flex items-end gap-2 pb-1.5">
            <Switch
              id="finance-compare-previous"
              checked={comparePrevious}
              onCheckedChange={setComparePrevious}
            />
            <Label htmlFor="finance-compare-previous" className="cursor-pointer font-normal">
              {t("pages.financeComparePrevious")}
            </Label>
          </div>
        )}
      </div>
      {comparePrevious && shiftId === ALL && (
        <p className="text-muted-foreground text-xs">
          {t("pages.financeComparePreviousHint")
            .replace("{from}", previousRange.from)
            .replace("{to}", previousRange.to)}
        </p>
      )}

      {/* KPI cards — the P&L's headline lines, in statement order */}
      {scopeNote("pl")}
      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] w-full" />
          ))}
        </div>
      ) : summary.isError ? (
        <div className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
          <ReportStatus
            isError
            onRetry={() => summary.refetch()}
            loadingLabel=""
            errorLabel={t("pages.financeLoadError")}
            retryLabel={t("common.actions.retry")}
          />
        </div>
      ) : s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t("pages.financeRevenue")}
            value={formatOrderPrice(s.revenue)}
            delta={<DeltaBadge metricKey="revenue" />}
            sub={
              <>
                <p>
                  {s.orderCount} {t("pages.financeOrders")} · {t("pages.financeAvgTicket")}{" "}
                  {formatOrderPrice(averageTicket(s.revenue, s.orderCount))}
                </p>
                {s.awaitingPaymentCount > 0 && (
                  <p className="text-amber-700 dark:text-amber-400">
                    {t("pages.financeAwaitingPaymentShort")
                      .replace("{amount}", formatOrderPrice(s.awaitingPaymentAmount))
                      .replace("{count}", String(s.awaitingPaymentCount))}
                  </p>
                )}
              </>
            }
          />
          <KpiCard
            label={t("pages.financeNetSales")}
            value={formatOrderPrice(s.netSales)}
            delta={<DeltaBadge metricKey="netSales" />}
            sub={
              <>
                <p>{t("pages.financeNetSalesSub")}</p>
                {(s.discountAmount > 0 || s.refundAmount > 0) && (
                  <p>
                    {t("pages.financeDiscount")} {formatOrderPrice(s.discountAmount)} ·{" "}
                    {t("pages.financeRefund")} {formatOrderPrice(s.refundAmount)}
                  </p>
                )}
              </>
            }
          />
          <KpiCard
            label={t("pages.financeGrossProfit")}
            value={formatOrderPrice(s.grossProfit)}
            delta={<DeltaBadge metricKey="grossProfit" />}
            sub={`${s.grossMarginPct.toFixed(1)}% ${t("pages.financeMargin")}`}
          />
          <KpiCard
            label={t("pages.financeNetProfit")}
            value={formatOrderPrice(s.netProfit)}
            delta={<DeltaBadge metricKey="netProfit" />}
            sub={
              wholeStoreView && expenses.data && expenses.data.total > 0
                ? t("pages.financeAfterExpensesSub").replace(
                    "{amount}",
                    formatOrderPrice(Math.round((s.netProfit - expenses.data.total) * 100) / 100)
                  )
                : s.netSales > 0
                  ? `${sharePct(s.netProfit, s.netSales).toFixed(1)}% ${t("pages.financeOfNetSales")}`
                  : undefined
            }
          />
          <KpiCard
            label={t("pages.financeCogs")}
            value={formatOrderPrice(s.cogs)}
            sub={
              // Annotates rather than blanks the figure: aggregator orders are
              // permanently uncosted, so hiding the whole P&L would hide it
              // forever for any store on Grab or Gojek.
              (s.unknownCostLines ?? 0) > 0
                ? t("finance.summary.unknownCost")
                    .replace("{count}", String(s.unknownCostLines))
                    .replace("{amount}", formatOrderPrice(s.unknownCostRevenue ?? 0))
                : s.netSales > 0
                  ? `${sharePct(s.cogs, s.netSales).toFixed(1)}% ${t("pages.financeOfNetSales")}`
                  : undefined
            }
          />
          <KpiCard
            label={t("pages.financeTax")}
            value={formatOrderPrice(s.taxCollected)}
            sub={t("pages.financeTaxOwedSub")}
          />
          <KpiCard
            label={t("pages.financeFeesAndCommission")}
            value={formatOrderPrice(
              Math.round((s.processingFee + s.platformCommission) * 100) / 100
            )}
            sub={
              <>
                <p>
                  {t("pages.financeProcessingFee")} {formatOrderPrice(s.processingFee)}
                </p>
                {s.platformCommission > 0 && (
                  <p>
                    {t("pages.financePlatformCommission")} {formatOrderPrice(s.platformCommission)}
                  </p>
                )}
              </>
            }
          />
          <KpiCard
            label={t("pages.financeWasteLoss")}
            value={formatOrderPrice(s.wasteLoss)}
            valueClassName={s.wasteLoss > 0 ? "text-red-600" : undefined}
          />
        </div>
      ) : null}

      {/* Department split — the "Kitchen vs Bar" daily report */}
      {byDepartment.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : byDepartment.isError ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            <ReportStatus
              isError
              onRetry={() => byDepartment.refetch()}
              loadingLabel=""
              errorLabel={t("pages.financeLoadError")}
              retryLabel={t("common.actions.retry")}
            />
          </CardContent>
        </Card>
      ) : (byDepartment.data?.departments.length ?? 0) > 0 ? (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t("pages.financeDepartmentSplit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {(byDepartment.data?.departments ?? []).map((d) => (
                <div key={d.department ?? "unassigned"} className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">{departmentLabel(d.department)}</p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatOrderPrice(d.totalRevenue)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {sharePct(d.totalRevenue, departmentTotals.totalRevenue)}% · {d.totalQuantity}{" "}
                    {t("pages.financeQtySold").toLowerCase()}
                  </p>
                </div>
              ))}
              <div className="space-y-0.5 border-l pl-8">
                <p className="text-muted-foreground text-xs">{t("pages.financeItemsSubtotal")}</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatOrderPrice(departmentTotals.totalRevenue)}
                </p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {departmentTotals.totalQuantity} {t("pages.financeQtySold").toLowerCase()}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              {t("pages.financeItemsSubtotalHint")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        {/* Sixteen reports: a picker on a phone, a wrapping tab bar above it. */}
        <div className="lg:hidden">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="h-10 w-full" aria-label={t("pages.financeReport")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TABS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden h-auto w-full flex-wrap justify-start gap-0.5 lg:flex">
          {REPORT_TABS.map((r) => (
            <TabsTrigger key={r.value} value={r.value} className="h-8 flex-none">
              {t(r.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* P&L Statement — an income statement that adds up line by line,
            each line also shown as a share of net sales, down to profit after
            the operating expenses recorded on the Expenses tab. */}
        <TabsContent value="pl">
          {summary.isLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : summary.isError || !s ? (
            <div className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
              <ReportStatus
                isError={summary.isError}
                onRetry={() => summary.refetch()}
                loadingLabel=""
                errorLabel={t("pages.financeLoadError")}
                retryLabel={t("common.actions.retry")}
              />
            </div>
          ) : (
            <FinancePnlStatement
              s={s}
              formatMoney={formatOrderPrice}
              expenses={expenses}
              expensesApply={wholeStoreView}
              renderDelta={(key) => <DeltaBadge metricKey={key} />}
            />
          )}
        </TabsContent>

        <TabsContent value="expenses">
          {scopeNote("expenses")}
          <FinanceExpensesTab
            storeId={storeId}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            formatMoney={formatOrderPrice}
          />
        </TabsContent>

        <TabsContent value="patterns">
          {scopeNote("patterns")}
          <SalesPatternsTab scope={insightScope} formatMoney={formatOrderPrice} />
        </TabsContent>

        <TabsContent value="adjustments">
          {scopeNote("adjustments")}
          <AdjustmentsTab scope={insightScope} formatMoney={formatOrderPrice} />
        </TabsContent>

        <TabsContent value="tax">
          {scopeNote("tax")}
          <TaxTab scope={insightScope} formatMoney={formatOrderPrice} />
        </TabsContent>

        <TabsContent value="labour">
          {scopeNote("labour")}
          <LabourTab
            scope={insightScope}
            formatMoney={formatOrderPrice}
            summary={wholeStoreView ? s : undefined}
          />
        </TabsContent>

        {/* Channels tab */}
        <TabsContent value="channels">
          {scopeNote("channels")}
          <div className="space-y-3 lg:hidden">
            {channels.isLoading || channels.isError ? (
              <MobileStatus isError={channels.isError} onRetry={() => channels.refetch()} />
            ) : sortedChannels.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {sortedChannels.map((c) => (
                  <div key={c.source} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground text-sm">
                        {c.orderCount} {t("pages.financeOrders")}
                      </span>
                    </div>
                    <CardLine
                      label={t("pages.financeRevenue")}
                      value={formatOrderPrice(c.revenue)}
                    />
                    {c.refundAmount > 0 && (
                      <CardLine
                        label={t("pages.financeRefund")}
                        value={`-${formatOrderPrice(c.refundAmount)}`}
                        tone="cost"
                      />
                    )}
                    {c.taxAmount > 0 && (
                      <CardLine
                        label={t("pages.financeTax")}
                        value={`-${formatOrderPrice(c.taxAmount)}`}
                        tone="cost"
                      />
                    )}
                    <CardLine
                      label={t("pages.financeCommission")}
                      value={
                        c.commissionPct > 0
                          ? `-${formatOrderPrice(c.commissionAmount)} (${c.commissionPct}%)`
                          : "—"
                      }
                      tone="cost"
                    />
                    <CardLine
                      label={t("pages.financeProcessingFee")}
                      value={
                        c.processingFeeAmount > 0
                          ? `-${formatOrderPrice(c.processingFeeAmount)}`
                          : "—"
                      }
                      tone="cost"
                    />
                    <CardLine
                      label={t("pages.financeNetRevenue")}
                      value={formatOrderPrice(c.netRevenue)}
                      strong
                    />
                  </div>
                ))}
                <TotalsCard
                  title={t("pages.financeTotal")}
                  lines={[
                    { label: t("pages.financeOrders"), value: String(channelTotals.orderCount) },
                    {
                      label: t("pages.financeRevenue"),
                      value: formatOrderPrice(channelTotals.revenue),
                    },
                    {
                      label: t("pages.financeRefund"),
                      value: formatOrderPrice(-channelTotals.refundAmount),
                    },
                    {
                      label: t("pages.financeTax"),
                      value: formatOrderPrice(-channelTotals.taxAmount),
                    },
                    {
                      label: t("pages.financeCommission"),
                      value: formatOrderPrice(-channelTotals.commissionAmount),
                    },
                    {
                      label: t("pages.financeProcessingFee"),
                      value: formatOrderPrice(-channelTotals.processingFeeAmount),
                    },
                    {
                      label: t("pages.financeNetRevenue"),
                      value: formatOrderPrice(channelTotals.netRevenue),
                      emphasis: "total",
                    },
                  ]}
                />
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[860px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={channelSort.sortField === "label"}
                      dir={channelSort.sortDir}
                      onClick={() => channelSort.toggleSort("label")}
                    >
                      {t("pages.financeChannel")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={channelSort.sortField === "orderCount"}
                      dir={channelSort.sortDir}
                      onClick={() => channelSort.toggleSort("orderCount")}
                    >
                      {t("pages.financeOrders")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={channelSort.sortField === "revenue"}
                      dir={channelSort.sortDir}
                      onClick={() => channelSort.toggleSort("revenue")}
                    >
                      {t("pages.financeRevenue")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeRefund")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeTax")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCommission")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeProcessingFee")}</TableHead>
                    <SortableHead
                      align="right"
                      active={channelSort.sortField === "netRevenue"}
                      dir={channelSort.sortDir}
                      onClick={() => channelSort.toggleSort("netRevenue")}
                    >
                      {t("pages.financeNetRevenue")}
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.isLoading || channels.isError ? (
                    <ReportStatusRow
                      isError={channels.isError}
                      colSpan={8}
                      onRetry={() => channels.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : sortedChannels.length === 0 ? (
                    <EmptyRow colSpan={8} />
                  ) : (
                    sortedChannels.map((c) => (
                      <TableRow key={c.source}>
                        <TableCell className="font-medium">{c.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(c.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 tabular-nums">
                          {c.refundAmount > 0 ? `-${formatOrderPrice(c.refundAmount)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 tabular-nums">
                          {c.taxAmount > 0 ? `-${formatOrderPrice(c.taxAmount)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 tabular-nums">
                          {c.commissionPct > 0
                            ? `-${formatOrderPrice(c.commissionAmount)} (${c.commissionPct}%)`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 tabular-nums">
                          {c.processingFeeAmount > 0
                            ? `-${formatOrderPrice(c.processingFeeAmount)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatOrderPrice(c.netRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {sortedChannels.length > 0 && !channels.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>{t("pages.financeTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {channelTotals.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(channelTotals.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(-channelTotals.refundAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(-channelTotals.taxAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(-channelTotals.commissionAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(-channelTotals.processingFeeAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(channelTotals.netRevenue)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">{t("pages.financeChannelsHint")}</p>
        </TabsContent>

        {/* Payment method breakdown tab */}
        <TabsContent value="paymentMethod">
          {scopeNote("paymentMethod")}
          <p className="text-muted-foreground mb-3 text-xs">{t("pages.financePaymentsHint")}</p>
          <div className="space-y-3 lg:hidden">
            {byPaymentMethod.isLoading || byPaymentMethod.isError ? (
              <MobileStatus
                isError={byPaymentMethod.isError}
                onRetry={() => byPaymentMethod.refetch()}
              />
            ) : sortedPaymentMethods.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {sortedPaymentMethods.map((m) => (
                  <div
                    key={m.paymentMethod}
                    className="bg-muted/50 space-y-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{paymentMethodLabel(m.paymentMethod)}</span>
                      <span className="text-muted-foreground text-sm">
                        {m.orderCount} {t("pages.financePayments").toLowerCase()}
                      </span>
                    </div>
                    <CardLine
                      label={t("pages.financeRevenue")}
                      value={`${formatOrderPrice(m.revenue)} (${m.percentOfTotal}%)`}
                      strong
                    />
                  </div>
                ))}
                <TotalsCard
                  title={t("pages.financeTotal")}
                  lines={[
                    { label: t("pages.financePayments"), value: String(paymentTotals.orderCount) },
                    {
                      label: t("pages.financeRevenue"),
                      value: formatOrderPrice(paymentTotals.revenue),
                      emphasis: "total",
                    },
                  ]}
                />
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[480px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={paymentMethodSort.sortField === "paymentMethod"}
                      dir={paymentMethodSort.sortDir}
                      onClick={() => paymentMethodSort.toggleSort("paymentMethod")}
                    >
                      {t("pages.financePaymentMethod")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={paymentMethodSort.sortField === "orderCount"}
                      dir={paymentMethodSort.sortDir}
                      onClick={() => paymentMethodSort.toggleSort("orderCount")}
                    >
                      {t("pages.financePayments")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={paymentMethodSort.sortField === "revenue"}
                      dir={paymentMethodSort.sortDir}
                      onClick={() => paymentMethodSort.toggleSort("revenue")}
                    >
                      {t("pages.financeRevenue")}
                    </SortableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byPaymentMethod.isLoading || byPaymentMethod.isError ? (
                    <ReportStatusRow
                      isError={byPaymentMethod.isError}
                      colSpan={4}
                      onRetry={() => byPaymentMethod.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : sortedPaymentMethods.length === 0 ? (
                    <EmptyRow colSpan={4} />
                  ) : (
                    sortedPaymentMethods.map((m) => (
                      <TableRow key={m.paymentMethod}>
                        <TableCell className="font-medium">
                          {paymentMethodLabel(m.paymentMethod)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.orderCount}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatOrderPrice(m.revenue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {m.percentOfTotal}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {sortedPaymentMethods.length > 0 && !byPaymentMethod.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>{t("pages.financeTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {paymentTotals.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(paymentTotals.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">100%</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Top items tab */}
        <TabsContent value="items">
          {scopeNote("items")}
          <div className="space-y-3 lg:hidden">
            {topItems.isLoading || topItems.isError ? (
              <MobileStatus isError={topItems.isError} onRetry={() => topItems.refetch()} />
            ) : sortedItems.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {sortedItems.map((item, i) => (
                  <div key={item.name} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">{i + 1}</span>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <CardLine label={t("pages.financeQtySold")} value={item.totalQuantity} />
                    <CardLine
                      label={t("pages.financeRevenue")}
                      value={
                        itemsBreakdown.all
                          ? `${formatOrderPrice(item.totalRevenue)} (${sharePct(item.totalRevenue, itemsBreakdown.all.totalRevenue)}%)`
                          : formatOrderPrice(item.totalRevenue)
                      }
                      strong
                    />
                  </div>
                ))}
                <TotalsCard
                  title={t("pages.financeTotal")}
                  lines={[
                    {
                      label: t("pages.financeTopSubtotal").replace(
                        "{count}",
                        String(itemsBreakdown.shown.itemCount)
                      ),
                      value: formatOrderPrice(itemsBreakdown.shown.totalRevenue),
                      emphasis: "subtotal",
                    },
                    ...(itemsBreakdown.other
                      ? [
                          {
                            label: t("pages.financeOtherItems").replace(
                              "{count}",
                              String(itemsBreakdown.other.itemCount)
                            ),
                            value: formatOrderPrice(itemsBreakdown.other.totalRevenue),
                          },
                        ]
                      : []),
                    ...(itemsBreakdown.all
                      ? [
                          {
                            label: t("pages.financeAllItems"),
                            value: formatOrderPrice(itemsBreakdown.all.totalRevenue),
                            emphasis: "total" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <SortableHead
                      active={itemSort.sortField === "name"}
                      dir={itemSort.sortDir}
                      onClick={() => itemSort.toggleSort("name")}
                    >
                      {t("common.name")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={itemSort.sortField === "totalQuantity"}
                      dir={itemSort.sortDir}
                      onClick={() => itemSort.toggleSort("totalQuantity")}
                    >
                      {t("pages.financeQtySold")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={itemSort.sortField === "totalRevenue"}
                      dir={itemSort.sortDir}
                      onClick={() => itemSort.toggleSort("totalRevenue")}
                    >
                      {t("pages.financeRevenue")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeShare")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.isLoading || topItems.isError ? (
                    <ReportStatusRow
                      isError={topItems.isError}
                      colSpan={5}
                      onRetry={() => topItems.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : sortedItems.length === 0 ? (
                    <EmptyRow colSpan={5} />
                  ) : (
                    sortedItems.map((item, i) => (
                      <TableRow key={item.name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.totalQuantity}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatOrderPrice(item.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {itemsBreakdown.all
                            ? `${sharePct(item.totalRevenue, itemsBreakdown.all.totalRevenue)}%`
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {sortedItems.length > 0 && !topItems.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell />
                      <TableCell>
                        {t("pages.financeTopSubtotal").replace(
                          "{count}",
                          String(itemsBreakdown.shown.itemCount)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {itemsBreakdown.shown.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(itemsBreakdown.shown.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {itemsBreakdown.all
                          ? `${sharePct(itemsBreakdown.shown.totalRevenue, itemsBreakdown.all.totalRevenue)}%`
                          : ""}
                      </TableCell>
                    </TableRow>
                    {itemsBreakdown.other && (
                      <TableRow className="text-muted-foreground font-normal">
                        <TableCell />
                        <TableCell>
                          {t("pages.financeOtherItems").replace(
                            "{count}",
                            String(itemsBreakdown.other.itemCount)
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {itemsBreakdown.other.totalQuantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(itemsBreakdown.other.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {itemsBreakdown.all
                            ? `${sharePct(itemsBreakdown.other.totalRevenue, itemsBreakdown.all.totalRevenue)}%`
                            : ""}
                        </TableCell>
                      </TableRow>
                    )}
                    {itemsBreakdown.all && (
                      <TableRow className="font-semibold">
                        <TableCell />
                        <TableCell>{t("pages.financeAllItems")}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {itemsBreakdown.all.totalQuantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(itemsBreakdown.all.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">100%</TableCell>
                      </TableRow>
                    )}
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Menu item / recipe margin tab */}
        <TabsContent value="margin">
          {scopeNote("margin")}
          <p className="text-muted-foreground mb-3 text-xs">{t("pages.financeUnknownCostHint")}</p>
          {menuClasses.size > 0 && (
            <p className="text-muted-foreground mb-3 text-xs">{t("pages.financeMenuClassHint")}</p>
          )}
          <div className="space-y-3 lg:hidden">
            {itemMargin.isLoading || itemMargin.isError ? (
              <MobileStatus isError={itemMargin.isError} onRetry={() => itemMargin.refetch()} />
            ) : sortedMarginItems.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {sortedMarginItems.map((item) => {
                  const menuClass = menuClasses.get(item.name);
                  return (
                    <div key={item.name} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.name}</span>
                        {menuClass && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${MENU_CLASS_STYLE[menuClass]}`}
                          >
                            {t(`pages.financeMenuClasses.${menuClass}`)}
                          </Badge>
                        )}
                      </div>
                      <CardLine label={t("pages.financeQtySold")} value={item.totalQuantity} />
                      <CardLine
                        label={t("pages.financeRevenue")}
                        value={formatOrderPrice(item.totalRevenue)}
                      />
                      <CardLine
                        label={t("pages.financeCost")}
                        value={item.totalCost != null ? formatOrderPrice(item.totalCost) : "—"}
                      />
                      <CardLine
                        label={t("pages.financeMarginAmount")}
                        value={
                          item.margin != null
                            ? `${formatOrderPrice(item.margin)} (${item.marginPct}%)`
                            : "—"
                        }
                        strong
                      />
                    </div>
                  );
                })}
                <TotalsCard
                  title={t("pages.financeCostedTotal")}
                  lines={[
                    {
                      label: t("pages.financeRevenue"),
                      value: formatOrderPrice(marginTotals.costedRevenue),
                    },
                    {
                      label: t("pages.financeCost"),
                      value: formatOrderPrice(marginTotals.totalCost),
                    },
                    ...(marginTotals.uncostedCount > 0
                      ? [
                          {
                            label: t("pages.financeUncostedItems").replace(
                              "{count}",
                              String(marginTotals.uncostedCount)
                            ),
                            value: formatOrderPrice(marginTotals.uncostedRevenue),
                          },
                        ]
                      : []),
                    {
                      label: t("pages.financeMarginAmount"),
                      value: `${formatOrderPrice(marginTotals.margin)} (${marginTotals.marginPct}%)`,
                      emphasis: "total",
                    },
                  ]}
                />
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[760px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={marginSort.sortField === "name"}
                      dir={marginSort.sortDir}
                      onClick={() => marginSort.toggleSort("name")}
                    >
                      {t("common.name")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeQtySold")}</TableHead>
                    <SortableHead
                      align="right"
                      active={marginSort.sortField === "totalRevenue"}
                      dir={marginSort.sortDir}
                      onClick={() => marginSort.toggleSort("totalRevenue")}
                    >
                      {t("pages.financeRevenue")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeCost")}</TableHead>
                    <SortableHead
                      align="right"
                      active={marginSort.sortField === "margin"}
                      dir={marginSort.sortDir}
                      onClick={() => marginSort.toggleSort("margin")}
                    >
                      {t("pages.financeMarginAmount")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={marginSort.sortField === "marginPct"}
                      dir={marginSort.sortDir}
                      onClick={() => marginSort.toggleSort("marginPct")}
                    >
                      {t("pages.financeMargin")}
                    </SortableHead>
                    <TableHead>{t("pages.financeMenuClass")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemMargin.isLoading || itemMargin.isError ? (
                    <ReportStatusRow
                      isError={itemMargin.isError}
                      colSpan={7}
                      onRetry={() => itemMargin.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : sortedMarginItems.length === 0 ? (
                    <EmptyRow colSpan={7} />
                  ) : (
                    sortedMarginItems.map((item) => {
                      const menuClass = menuClasses.get(item.name);
                      return (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.totalQuantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatOrderPrice(item.totalRevenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.totalCost != null ? formatOrderPrice(item.totalCost) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {item.margin != null ? formatOrderPrice(item.margin) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.marginPct != null ? `${item.marginPct}%` : "—"}
                          </TableCell>
                          <TableCell>
                            {menuClass && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${MENU_CLASS_STYLE[menuClass]}`}
                              >
                                {t(`pages.financeMenuClasses.${menuClass}`)}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {sortedMarginItems.length > 0 && !itemMargin.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>{t("pages.financeCostedTotal")}</TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(marginTotals.costedRevenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(marginTotals.totalCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(marginTotals.margin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {marginTotals.marginPct}%
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {marginTotals.uncostedCount > 0 && (
                      <TableRow className="text-muted-foreground font-normal">
                        <TableCell>
                          {t("pages.financeUncostedItems").replace(
                            "{count}",
                            String(marginTotals.uncostedCount)
                          )}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(marginTotals.uncostedRevenue)}
                        </TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    <TableRow className="font-semibold">
                      <TableCell>{t("pages.financeAllItems")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {marginTotals.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(marginTotals.totalRevenue)}
                      </TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* By category tab */}
        <TabsContent value="category">
          {scopeNote("category")}
          <div className="space-y-3 lg:hidden">
            {byCategory.isLoading || byCategory.isError ? (
              <MobileStatus isError={byCategory.isError} onRetry={() => byCategory.refetch()} />
            ) : sortedCategories.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {sortedCategories.map((c) => (
                  <div
                    key={c.categoryId ?? "none"}
                    className="bg-muted/50 space-y-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {c.categoryId ? c.categoryName : t("pages.financeUncategorized")}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {c.orderCount} {t("pages.financeOrders")}
                      </span>
                    </div>
                    <CardLine label={t("pages.financeQtySold")} value={c.totalQuantity} />
                    <CardLine
                      label={t("pages.financeRevenue")}
                      value={`${formatOrderPrice(c.totalRevenue)} (${sharePct(c.totalRevenue, categoryTotals?.totalRevenue ?? 0)}%)`}
                      strong
                    />
                  </div>
                ))}
                {categoryTotals && (
                  <TotalsCard
                    title={t("pages.financeTotal")}
                    lines={[
                      {
                        label: t("pages.financeItemsSubtotal"),
                        value: formatOrderPrice(categoryTotals.totalRevenue),
                        emphasis: "subtotal",
                      },
                      ...(s
                        ? [
                            {
                              label: t("pages.financeOrderAdjustments"),
                              value: formatOrderPrice(
                                Math.round((s.revenue - categoryTotals.totalRevenue) * 100) / 100
                              ),
                            },
                            {
                              label: t("pages.financeRevenue"),
                              value: formatOrderPrice(s.revenue),
                              emphasis: "total" as const,
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={categorySort.sortField === "categoryName"}
                      dir={categorySort.sortDir}
                      onClick={() => categorySort.toggleSort("categoryName")}
                    >
                      {t("pages.financeCategory")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
                    <SortableHead
                      align="right"
                      active={categorySort.sortField === "totalQuantity"}
                      dir={categorySort.sortDir}
                      onClick={() => categorySort.toggleSort("totalQuantity")}
                    >
                      {t("pages.financeQtySold")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={categorySort.sortField === "totalRevenue"}
                      dir={categorySort.sortDir}
                      onClick={() => categorySort.toggleSort("totalRevenue")}
                    >
                      {t("pages.financeRevenue")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeShare")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.isLoading || byCategory.isError ? (
                    <ReportStatusRow
                      isError={byCategory.isError}
                      colSpan={5}
                      onRetry={() => byCategory.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : sortedCategories.length === 0 ? (
                    <EmptyRow colSpan={5} />
                  ) : (
                    sortedCategories.map((c) => (
                      <TableRow key={c.categoryId ?? "none"}>
                        <TableCell className="font-medium">
                          {c.categoryId ? c.categoryName : t("pages.financeUncategorized")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.totalQuantity}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatOrderPrice(c.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {sharePct(c.totalRevenue, categoryTotals?.totalRevenue ?? 0)}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {categoryTotals && sortedCategories.length > 0 && !byCategory.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>{t("pages.financeItemsSubtotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {categoryTotals.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {categoryTotals.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(categoryTotals.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">100%</TableCell>
                    </TableRow>
                    {s && (
                      <>
                        <TableRow className="text-muted-foreground font-normal">
                          <TableCell>{t("pages.financeOrderAdjustments")}</TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-right tabular-nums">
                            {formatOrderPrice(
                              Math.round((s.revenue - categoryTotals.totalRevenue) * 100) / 100
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                        <TableRow className="font-semibold">
                          <TableCell>{t("pages.financeRevenue")}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.orderCount}</TableCell>
                          <TableCell />
                          <TableCell className="text-right tabular-nums">
                            {formatOrderPrice(s.revenue)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    )}
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            {t("pages.financeOrderAdjustmentsHint")}
          </p>
        </TabsContent>

        {/* By shift tab — the "total sales from open to close" report */}
        <TabsContent value="shift">
          {scopeNote("shift")}
          <div className="space-y-3 lg:hidden">
            {byShift.isLoading || byShift.isError ? (
              <MobileStatus isError={byShift.isError} onRetry={() => byShift.refetch()} />
            ) : sortedShifts.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {sortedShifts.map((sh) => (
                  <div
                    key={sh.shiftId ?? "unassigned"}
                    className="bg-muted/50 space-y-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {sh.shiftId ? sh.staffName : t("pages.financeUnassigned")}
                      </span>
                      {sh.shiftId && (
                        <Badge variant={sh.isOpen ? "default" : "outline"}>
                          {sh.isOpen
                            ? t("pages.financeShiftStatusOpen")
                            : t("pages.financeShiftStatusClosed")}
                        </Badge>
                      )}
                    </div>
                    {sh.openedAt && (
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(sh.openedAt)}
                        {sh.closedAt ? ` — ${formatDateTime(sh.closedAt)}` : ""}
                      </p>
                    )}
                    <CardLine label={t("pages.financeOrders")} value={sh.orderCount} />
                    <CardLine
                      label={t("pages.financeAvgTicket")}
                      value={formatOrderPrice(averageTicket(sh.revenue, sh.orderCount))}
                    />
                    <CardLine
                      label={t("pages.financeRevenue")}
                      value={formatOrderPrice(sh.revenue)}
                      strong
                    />
                  </div>
                ))}
                <TotalsCard
                  title={t("pages.financeTotal")}
                  lines={[
                    { label: t("pages.financeOrders"), value: String(shiftTotals.orderCount) },
                    {
                      label: t("pages.financeAvgTicket"),
                      value: formatOrderPrice(
                        averageTicket(shiftTotals.revenue, shiftTotals.orderCount)
                      ),
                    },
                    {
                      label: t("pages.financeRevenue"),
                      value: formatOrderPrice(shiftTotals.revenue),
                      emphasis: "total",
                    },
                  ]}
                />
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[680px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={shiftSort.sortField === "staffName"}
                      dir={shiftSort.sortDir}
                      onClick={() => shiftSort.toggleSort("staffName")}
                    >
                      {t("pages.financeCashier")}
                    </SortableHead>
                    <SortableHead
                      active={shiftSort.sortField === "openedAt"}
                      dir={shiftSort.sortDir}
                      onClick={() => shiftSort.toggleSort("openedAt")}
                    >
                      {t("pages.financeShiftPeriod")}
                    </SortableHead>
                    <SortableHead
                      align="right"
                      active={shiftSort.sortField === "orderCount"}
                      dir={shiftSort.sortDir}
                      onClick={() => shiftSort.toggleSort("orderCount")}
                    >
                      {t("pages.financeOrders")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeAvgTicket")}</TableHead>
                    <SortableHead
                      align="right"
                      active={shiftSort.sortField === "revenue"}
                      dir={shiftSort.sortDir}
                      onClick={() => shiftSort.toggleSort("revenue")}
                    >
                      {t("pages.financeRevenue")}
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byShift.isLoading || byShift.isError ? (
                    <ReportStatusRow
                      isError={byShift.isError}
                      colSpan={5}
                      onRetry={() => byShift.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : sortedShifts.length === 0 ? (
                    <EmptyRow colSpan={5} />
                  ) : (
                    sortedShifts.map((sh) => (
                      <TableRow key={sh.shiftId ?? "unassigned"}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {sh.shiftId ? sh.staffName : t("pages.financeUnassigned")}
                            {sh.shiftId && (
                              <Badge
                                variant={sh.isOpen ? "default" : "outline"}
                                className="text-xs"
                              >
                                {sh.isOpen
                                  ? t("pages.financeShiftStatusOpen")
                                  : t("pages.financeShiftStatusClosed")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {sh.openedAt ? (
                            <>
                              {formatDateTime(sh.openedAt)}
                              {sh.closedAt ? ` — ${formatDateTime(sh.closedAt)}` : ""}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{sh.orderCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(averageTicket(sh.revenue, sh.orderCount))}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatOrderPrice(sh.revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {sortedShifts.length > 0 && !byShift.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>{t("pages.financeTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {shiftTotals.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(
                          averageTicket(shiftTotals.revenue, shiftTotals.orderCount)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(shiftTotals.revenue)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Revenue per named shift-block ("Shift 1", etc.) — a coverage-window
            report, not a partition: blocks can overlap by design (staggered
            handover coverage), so totals across rows are NOT expected to sum
            to the grand total. */}
        <TabsContent value="scheduleShift" className="space-y-4">
          {scopeNote("scheduleShift")}
          <p className="text-muted-foreground text-xs">
            {t("pages.financeScheduleShiftOverlapNote")}
          </p>
          {byScheduleShift.isLoading || byScheduleShift.isError ? (
            <MobileStatus
              isError={byScheduleShift.isError}
              onRetry={() => byScheduleShift.refetch()}
            />
          ) : (
            <>
              {/* One subtotal per block: a block never overlaps itself, so its
                  own days add up — different blocks do not. */}
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <div className="min-w-[520px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("pages.financeScheduleShiftBlock")}</TableHead>
                        <TableHead className="text-right">{t("pages.financeActiveDays")}</TableHead>
                        <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
                        <TableHead className="text-right">{t("pages.financeAvgTicket")}</TableHead>
                        <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockSubtotals.length === 0 ? (
                        <EmptyRow colSpan={5} />
                      ) : (
                        blockSubtotals.map((b) => (
                          <TableRow key={b.scheduleShiftId}>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-2">
                                {b.color && (
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: b.color }}
                                  />
                                )}
                                {b.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.activeDays}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.orderCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatOrderPrice(averageTicket(b.revenue, b.orderCount))}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatOrderPrice(b.revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    {byScheduleShift.data?.totals && blockSubtotals.length > 0 && (
                      <TableFooter>
                        <TableRow className="text-muted-foreground font-normal">
                          <TableCell>{t("pages.financeOutsideBlocks")}</TableCell>
                          <TableCell />
                          <TableCell className="text-right tabular-nums">
                            {byScheduleShift.data.totals.outsideOrderCount}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right tabular-nums">
                            {formatOrderPrice(byScheduleShift.data.totals.outsideRevenue)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{t("pages.financeAllOrdersOnce")}</TableCell>
                          <TableCell />
                          <TableCell className="text-right tabular-nums">
                            {byScheduleShift.data.totals.orderCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatOrderPrice(
                              averageTicket(
                                byScheduleShift.data.totals.revenue,
                                byScheduleShift.data.totals.orderCount
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatOrderPrice(byScheduleShift.data.totals.revenue)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </div>

              {/* Day by day */}
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <div className="min-w-[640px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("pages.financeScheduleShiftBlock")}</TableHead>
                        <TableHead>{t("common.date")}</TableHead>
                        <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
                        <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                        <TableHead>{t("pages.financeStaffOnDuty")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(byScheduleShift.data?.rows ?? []).filter((r) => r.orderCount > 0).length ===
                      0 ? (
                        <EmptyRow colSpan={5} />
                      ) : (
                        (byScheduleShift.data?.rows ?? [])
                          .filter((r) => r.orderCount > 0)
                          .map((r) => (
                            <TableRow key={`${r.scheduleShiftId}:${r.date}`}>
                              <TableCell className="font-medium">
                                <span className="flex items-center gap-2">
                                  {r.color && (
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: r.color }}
                                    />
                                  )}
                                  {r.name}
                                </span>
                              </TableCell>
                              <TableCell>{r.date}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.orderCount}
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {formatOrderPrice(r.revenue)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {r.staffOnDuty.map((member) => member.name).join(", ") || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Cash-drawer reconciliation tab — the live per-category position of
            every till session (float, cash sales, refunds, tips, float
            top-ups, paid-outs, safe drops, tip payouts) next to what was
            actually counted, so a variance can be explained and not just
            spotted. Flags a CLOSED session whose count didn't match; an open
            session has a live expected figure but nothing to compare it to. */}
        <TabsContent value="cash">
          {scopeNote("cash")}
          <div className="space-y-3 lg:hidden">
            {cashReconciliation.isLoading || cashReconciliation.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={cashReconciliation.isError}
                  onRetry={() => cashReconciliation.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              <>
                {cashTotals && (
                  <div className="bg-card space-y-2 rounded-lg border p-4">
                    <p className="font-medium">{t("pages.financeCashTotals")}</p>
                    {/* Same rule as the per-session cards below: float and
                        sales always, the rest only when non-zero, so the
                        lines add up to Expected. */}
                    <CashCardLine
                      label={t("pages.financeOpeningCash")}
                      value={formatOrderPrice(cashTotals.openingCash)}
                    />
                    <CashCardLine
                      label={t("pages.financeCashSales")}
                      value={formatOrderPrice(cashTotals.cashSales)}
                    />
                    {CASH_CATEGORY_LINES.map(
                      ({ key, labelKey }) =>
                        cashTotals[key] !== 0 && (
                          <CashCardLine
                            key={key}
                            label={t(labelKey)}
                            value={formatOrderPrice(cashTotals[key])}
                          />
                        )
                    )}
                    <CashCardLine
                      label={t("pages.financeExpectedCash")}
                      value={formatOrderPrice(cashTotals.expectedCash)}
                      emphasis="total"
                    />
                    <CashCardLine
                      label={t("pages.financeClosingCash")}
                      value={
                        cashTotals.closingCash != null
                          ? formatOrderPrice(cashTotals.closingCash)
                          : "—"
                      }
                    />
                    <CashCardLine
                      label={t("pages.financeCashDifference")}
                      value={
                        cashTotals.cashDifference != null
                          ? formatOrderPrice(cashTotals.cashDifference)
                          : "—"
                      }
                      emphasis={cashTotals.cashDifference ? "variance" : "total"}
                    />
                    {cashTotals.closingCash == null && (
                      <p className="text-muted-foreground text-xs">
                        {t("pages.cashOnHandProvisional")}
                      </p>
                    )}
                  </div>
                )}
                {sortedCashRows.map((row) => (
                  <div key={row.shiftId} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{row.staffName}</span>
                      <div className="flex gap-1.5">
                        <Badge variant={row.isOpen ? "default" : "outline"}>
                          {row.isOpen
                            ? t("pages.financeShiftStatusOpen")
                            : t("pages.financeShiftStatusClosed")}
                        </Badge>
                        {row.isFlagged && (
                          <Badge variant="destructive">{t("pages.financeFlagged")}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">{formatDateTime(row.openedAt)}</p>
                    {/* Float and sales always show; every discretionary
                        category shows only when non-zero. That keeps the card
                        as short as a "drivers only" cut in the common case,
                        while guaranteeing the visible lines actually sum to
                        the Expected total below — on a reconciliation screen,
                        arithmetic that doesn't add up reads as a bug. */}
                    <CashCardLine
                      label={t("pages.financeOpeningCash")}
                      value={formatOrderPrice(row.openingCash)}
                    />
                    <CashCardLine
                      label={t("pages.financeCashSales")}
                      value={formatOrderPrice(row.cashSales)}
                    />
                    {CASH_CATEGORY_LINES.map(
                      ({ key, labelKey }) =>
                        row[key] !== 0 && (
                          <CashCardLine
                            key={key}
                            label={t(labelKey)}
                            value={formatOrderPrice(row[key])}
                          />
                        )
                    )}
                    <CashCardLine
                      label={t("pages.financeExpectedCash")}
                      value={formatOrderPrice(row.expectedCash)}
                      emphasis="total"
                    />
                    <CashCardLine
                      label={t("pages.financeClosingCash")}
                      value={row.closingCash != null ? formatOrderPrice(row.closingCash) : "—"}
                    />
                    <CashCardLine
                      label={t("pages.financeCashDifference")}
                      value={
                        row.cashDifference != null ? formatOrderPrice(row.cashDifference) : "—"
                      }
                      emphasis={row.isFlagged ? "variance" : "total"}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            {/* Thirteen columns of currency — wide on purpose. Scrolling beats
                crushing every figure into an unreadable column. */}
            <div className="min-w-[1400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={cashSort.sortField === "staffName"}
                      dir={cashSort.sortDir}
                      onClick={() => cashSort.toggleSort("staffName")}
                    >
                      {t("pages.financeCashier")}
                    </SortableHead>
                    <SortableHead
                      active={cashSort.sortField === "openedAt"}
                      dir={cashSort.sortDir}
                      onClick={() => cashSort.toggleSort("openedAt")}
                    >
                      {t("pages.financeShiftPeriod")}
                    </SortableHead>
                    <TableHead className="text-right">{t("pages.financeOpeningCash")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashSales")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashRefunds")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashTips")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashPettyIn")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashPettyOut")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashDrops")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCashTipPayouts")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeExpectedCash")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeClosingCash")}</TableHead>
                    <SortableHead
                      align="right"
                      active={cashSort.sortField === "cashDifference"}
                      dir={cashSort.sortDir}
                      onClick={() => cashSort.toggleSort("cashDifference")}
                    >
                      {t("pages.financeCashDifference")}
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashReconciliation.isLoading || cashReconciliation.isError ? (
                    <ReportStatusRow
                      isError={cashReconciliation.isError}
                      colSpan={13}
                      onRetry={() => cashReconciliation.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedCashRows.map((row) => (
                      <TableRow
                        key={row.shiftId}
                        className={row.isFlagged ? "bg-destructive/5" : undefined}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {row.staffName}
                            <Badge variant={row.isOpen ? "default" : "outline"} className="text-xs">
                              {row.isOpen
                                ? t("pages.financeShiftStatusOpen")
                                : t("pages.financeShiftStatusClosed")}
                            </Badge>
                            {row.isFlagged && (
                              <Badge variant="destructive" className="text-xs">
                                {t("pages.financeFlagged")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(row.openedAt)}
                          {row.closedAt ? ` — ${formatDateTime(row.closedAt)}` : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.openingCash)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.cashSales)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.cashRefunds)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.tips)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.pettyIn)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.pettyOut)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.drops)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(row.tipPayouts)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatOrderPrice(row.expectedCash)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.closingCash != null ? formatOrderPrice(row.closingCash) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold tabular-nums ${row.isFlagged ? "text-destructive" : ""}`}
                        >
                          {row.cashDifference != null ? formatOrderPrice(row.cashDifference) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {cashTotals && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="whitespace-nowrap">
                        {t("pages.financeCashTotals")}
                        {cashTotals.closingCash == null && (
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {t("pages.cashOnHandProvisional")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.openingCash)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.cashSales)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.cashRefunds)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.tips)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.pettyIn)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.pettyOut)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.drops)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.tipPayouts)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(cashTotals.expectedCash)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cashTotals.closingCash != null
                          ? formatOrderPrice(cashTotals.closingCash)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${cashTotals.cashDifference ? "text-destructive" : ""}`}
                      >
                        {cashTotals.cashDifference != null
                          ? formatOrderPrice(cashTotals.cashDifference)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Daily breakdown tab */}
        <TabsContent value="daily">
          {scopeNote("daily")}
          <div className="space-y-3 lg:hidden">
            {summary.isLoading || summary.isError ? (
              <MobileStatus isError={summary.isError} onRetry={() => summary.refetch()} />
            ) : (s?.buckets ?? []).length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
            ) : (
              <>
                {(s?.buckets ?? []).map((b) => (
                  <div key={b.date} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{b.date}</span>
                      <span className="text-muted-foreground text-sm">
                        {b.orderCount} {t("pages.financeOrders")}
                      </span>
                    </div>
                    <CardLine
                      label={t("pages.financeRevenue")}
                      value={formatOrderPrice(b.revenue)}
                    />
                    {b.refundAmount > 0 && (
                      <CardLine
                        label={t("pages.financeRefund")}
                        value={`-${formatOrderPrice(b.refundAmount)}`}
                        tone="cost"
                      />
                    )}
                    {b.taxCollected > 0 && (
                      <CardLine
                        label={t("pages.financeTax")}
                        value={`-${formatOrderPrice(b.taxCollected)}`}
                        tone="cost"
                      />
                    )}
                    <CardLine
                      label={t("pages.financeNetSales")}
                      value={formatOrderPrice(b.netSales)}
                      strong
                    />
                  </div>
                ))}
                <TotalsCard
                  title={t("pages.financeTotal")}
                  lines={[
                    { label: t("pages.financeOrders"), value: String(dailyTotals.orderCount) },
                    {
                      label: t("pages.financeRevenue"),
                      value: formatOrderPrice(dailyTotals.revenue),
                    },
                    {
                      label: t("pages.financeDiscount"),
                      value: formatOrderPrice(dailyTotals.discountAmount),
                    },
                    {
                      label: t("pages.financeRefund"),
                      value: formatOrderPrice(-dailyTotals.refundAmount),
                    },
                    {
                      label: t("pages.financeTax"),
                      value: formatOrderPrice(-dailyTotals.taxCollected),
                    },
                    {
                      label: t("pages.financeNetSales"),
                      value: formatOrderPrice(dailyTotals.netSales),
                      emphasis: "total",
                    },
                  ]}
                />
              </>
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[760px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeDiscount")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRefund")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeTax")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeNetSales")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeAvgTicket")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.isLoading || summary.isError ? (
                    <ReportStatusRow
                      isError={summary.isError}
                      colSpan={8}
                      onRetry={() => summary.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (s?.buckets ?? []).length === 0 ? (
                    <EmptyRow colSpan={8} />
                  ) : (
                    (s?.buckets ?? []).map((b) => (
                      <TableRow key={b.date}>
                        <TableCell className="whitespace-nowrap">{b.date}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.orderCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(b.revenue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {b.discountAmount > 0 ? formatOrderPrice(b.discountAmount) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 tabular-nums">
                          {b.refundAmount > 0 ? `-${formatOrderPrice(b.refundAmount)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 tabular-nums">
                          {b.taxCollected > 0 ? `-${formatOrderPrice(b.taxCollected)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatOrderPrice(b.netSales)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatOrderPrice(averageTicket(b.revenue, b.orderCount))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {(s?.buckets ?? []).length > 0 && !summary.isLoading && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>{t("pages.financeTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dailyTotals.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(dailyTotals.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(dailyTotals.discountAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(-dailyTotals.refundAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(-dailyTotals.taxCollected)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(dailyTotals.netSales)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatOrderPrice(
                          averageTicket(dailyTotals.revenue, dailyTotals.orderCount)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">{t("pages.financeDailyHint")}</p>
        </TabsContent>

        {/* Waste tab — itemized loss with inline correction (edit/delete) */}
        <TabsContent value="waste" className="space-y-4">
          {(wasteByReason.data?.reasons.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {(wasteByReason.data?.reasons ?? []).map((r) => (
                <Badge key={r.reason + r.label} variant="outline" className="gap-1.5 py-1.5">
                  <span>{r.label}</span>
                  <span className="text-muted-foreground">
                    {formatPrice(r.totalValue)} ·{" "}
                    {sharePct(r.totalValue, wasteEntries.data?.sumValue ?? 0)}%
                  </span>
                </Badge>
              ))}
              <Badge variant="secondary" className="gap-1.5 py-1.5 font-semibold">
                <span>{t("pages.financeTotal")}</span>
                <span>{formatPrice(wasteEntries.data?.sumValue ?? 0)}</span>
              </Badge>
            </div>
          )}
          {(wasteEntries.data?.total ?? 0) > (wasteEntries.data?.entries.length ?? 0) && (
            <p className="text-muted-foreground text-xs">
              {t("pages.financeShowingEntries")
                .replace("{shown}", String(wasteEntries.data?.entries.length ?? 0))
                .replace("{total}", String(wasteEntries.data?.total ?? 0))}
            </p>
          )}

          <div className="space-y-3 lg:hidden">
            {wasteEntries.isLoading || wasteEntries.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={wasteEntries.isError}
                  onRetry={() => wasteEntries.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (wasteEntries.data?.entries.length ?? 0) === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t("waste.empty") || "No waste recorded for this period"}
              </p>
            ) : (
              (wasteEntries.data?.entries ?? []).map((entry) => (
                <div key={entry.id} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {entry.material?.name ?? entry.product?.name ?? "—"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {entry.reason === "OTHER"
                        ? (entry.customReason ?? entry.reason)
                        : entry.reason}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("waste.table.quantity")}</span>
                    <span>
                      {entry.quantity} {entry.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("waste.table.totalValue")}</span>
                    <span>{formatPrice(entry.totalValue)}</span>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleEditWaste(entry)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {t("waste.actions.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setWasteDeleteTarget(entry)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {t("waste.actions.delete")}
                    </Button>
                  </div>
                </div>
              ))
            )}
            {(wasteEntries.data?.entries.length ?? 0) > 0 && (
              <TotalsCard
                title={t("pages.financeTotal")}
                lines={[
                  {
                    label: t("pages.financeEntries"),
                    value: String(wasteEntries.data?.total ?? 0),
                  },
                  {
                    label: t("pages.financeWasteLoss"),
                    value: formatPrice(wasteEntries.data?.sumValue ?? 0),
                    emphasis: "total",
                  },
                ]}
              />
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[760px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("waste.table.date")}</TableHead>
                    <TableHead>{t("waste.table.item")}</TableHead>
                    <TableHead>{t("waste.table.reason")}</TableHead>
                    <TableHead className="text-right">{t("waste.table.quantity")}</TableHead>
                    <TableHead className="text-right">{t("waste.table.unitCost")}</TableHead>
                    <TableHead className="text-right">{t("waste.table.totalValue")}</TableHead>
                    <TableHead className="text-right">{t("waste.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteEntries.isLoading || wasteEntries.isError ? (
                    <ReportStatusRow
                      isError={wasteEntries.isError}
                      colSpan={7}
                      onRetry={() => wasteEntries.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (wasteEntries.data?.entries.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                        {t("waste.empty") || "No waste recorded for this period"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (wasteEntries.data?.entries ?? []).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.material?.name ?? entry.product?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.reason === "OTHER"
                              ? (entry.customReason ?? entry.reason)
                              : entry.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.quantity} {entry.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(entry.unitCostSnapshot)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(entry.totalValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditWaste(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-8 w-8"
                              onClick={() => setWasteDeleteTarget(entry)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {(wasteEntries.data?.entries.length ?? 0) > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>
                        {t("pages.financeTotal")} ({wasteEntries.data?.total ?? 0})
                      </TableCell>
                      <TableCell colSpan={3} />
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(wasteEntries.data?.sumValue ?? 0)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <WasteFormDialog
        open={wasteDialogOpen}
        onOpenChange={(open) => {
          setWasteDialogOpen(open);
          if (!open) setEditingWasteEntry(null);
        }}
        storeId={storeId}
        mode="edit"
        wasteEntry={editingWasteEntry}
      />

      <AlertDialog
        open={!!wasteDeleteTarget}
        onOpenChange={(open) => {
          if (!open) setWasteDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("waste.deleteConfirm.title") || "Delete waste entry?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("waste.deleteConfirm.description") ||
                "This restores the recorded quantity back to current stock and removes the entry."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWasteEntry.isPending}>
              {t("common.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWasteConfirm}
              disabled={deleteWasteEntry.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("waste.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
