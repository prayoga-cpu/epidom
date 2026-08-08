"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { Download, FileText, Sheet, Pencil, Trash2, AlertCircle, Store } from "lucide-react";
import { useSortable, sortRows } from "@/features/dashboard/shared/hooks/use-sortable";
import { SortIcon } from "@/features/dashboard/shared/components/sort-icon";
import { DateRangeField } from "@/components/ui/date-range-field";
import {
  todayLocalISO,
  startOfMonthLocalISO,
  previousPeriodLocalISO,
} from "@/lib/utils/date-range";
import { Switch } from "@/components/ui/switch";
import { WasteFormDialog } from "@/features/dashboard/management/waste/waste-form-dialog";
import { AGGREGATOR_LABELS } from "@/config/aggregator.config";
import {
  useWasteEntries,
  useDeleteWasteEntry,
  type WasteEntryWithRelations,
} from "@/features/dashboard/management/waste/hooks/use-waste";

interface SummaryData {
  from: string;
  to: string;
  revenue: number;
  grossRevenue: number;
  discountAmount: number;
  refundAmount: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  wasteLoss: number;
  taxCollected: number;
  serviceCharge: number;
  processingFee: number;
  netRevenue: number;
  netProfit: number;
  orderCount: number;
  buckets: { date: string; revenue: number }[];
}

interface WasteReasonRow {
  reason: string;
  label: string;
  entryCount: number;
  totalQuantity: number;
  totalValue: number;
}

interface ChannelRow {
  source: string;
  label: string;
  orderCount: number;
  revenue: number;
  commissionPct: number;
  commissionAmount: number;
  taxAmount: number;
  processingFeeAmount: number;
  netRevenue: number;
}

interface TopItem {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface CategoryRow {
  categoryId: string | null;
  categoryName: string;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface DepartmentRow {
  department: "KITCHEN" | "BAR" | null;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface ShiftRow {
  shiftId: string | null;
  staffName: string;
  staffId: string | null;
  openedAt: string | null;
  closedAt: string | null;
  isOpen: boolean;
  orderCount: number;
  revenue: number;
}

interface ScheduleShiftBucketRow {
  scheduleShiftId: string;
  name: string;
  date: string;
  orderCount: number;
  revenue: number;
  color: string | null;
  staffOnDuty: { staffMemberId: string; name: string; department: string | null }[];
}

interface PaymentMethodRow {
  paymentMethod: string;
  orderCount: number;
  revenue: number;
  percentOfTotal: number;
}

interface CashReconciliationRow {
  shiftId: string;
  staffName: string;
  staffId: string;
  openedAt: string;
  closedAt: string | null;
  isOpen: boolean;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  isFlagged: boolean;
}

interface ItemMarginRow {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number | null;
  margin: number | null;
  marginPct: number | null;
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface FinanceClientProps {
  storeId: string;
  staff: StaffOption[];
  categories: CategoryOption[];
  /** Shows a link to the cross-store /owner rollup — only meaningful when
   * this store's business actually has more than one store. */
  showOwnerLink?: boolean;
}

const ALL = "all";

const CHANNEL_OPTIONS = [
  "MANUAL",
  "STOREFRONT",
  "POS",
  "GOFOOD",
  "GRABFOOD",
  "SHOPEEFOOD",
  "TOKOPEDIA",
] as const;

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
] as const;

function SortableHead({
  active,
  dir,
  onClick,
  children,
  align,
}: {
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  children: ReactNode;
  align?: "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        className={`hover:text-foreground flex items-center font-semibold ${
          align === "right" ? "ml-auto" : ""
        }`}
        onClick={onClick}
      >
        {children}
        <SortIcon active={active} dir={dir} />
      </button>
    </TableHead>
  );
}

/**
 * A report tab/query must never go from "visible" to silently blank on
 * error — every `X.isLoading`/`X.isError` pair below renders through one of
 * these instead of a bare `{data && ...}`/`isLoading ? "Loading..." : ...`
 * that has no failure branch.
 */
function ReportStatus({
  isError,
  onRetry,
  loadingLabel,
  errorLabel,
  retryLabel,
}: {
  isError: boolean;
  onRetry: () => void;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
}) {
  if (!isError) return <>{loadingLabel}</>;
  return (
    <div className="flex flex-col items-center gap-2">
      <AlertCircle className="text-destructive h-5 w-5" />
      <p>{errorLabel}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

function ReportStatusRow({
  isError,
  colSpan,
  onRetry,
  loadingLabel,
  errorLabel,
  retryLabel,
}: {
  isError: boolean;
  colSpan: number;
  onRetry: () => void;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground py-8 text-center">
        <ReportStatus
          isError={isError}
          onRetry={onRetry}
          loadingLabel={loadingLabel}
          errorLabel={errorLabel}
          retryLabel={retryLabel}
        />
      </TableCell>
    </TableRow>
  );
}

export function FinanceClient({ storeId, staff, categories, showOwnerLink }: FinanceClientProps) {
  const { t, formatDateTime } = useI18n();
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

  const [from, setFromState] = useState(searchParams.get("from") ?? startOfMonthLocalISO());
  const [to, setToState] = useState(searchParams.get("to") ?? todayLocalISO());
  const [staffId, setStaffIdState] = useState(searchParams.get("staffId") ?? ALL);
  const [categoryId, setCategoryIdState] = useState(searchParams.get("category") ?? ALL);
  const [department, setDepartmentState] = useState(searchParams.get("department") ?? ALL);
  const [channel, setChannelState] = useState(searchParams.get("channel") ?? ALL);
  const [paymentMethod, setPaymentMethodState] = useState(
    searchParams.get("paymentMethod") ?? ALL
  );
  const [comparePrevious, setComparePreviousState] = useState(
    searchParams.get("compare") === "1"
  );

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
    syncUrl({ from: nextFrom, to: nextTo });
  };
  const setStaffId = (v: string) => {
    setStaffIdState(v);
    syncUrl({ staffId: v });
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

  const channelLabel = (source: string) => {
    switch (source) {
      case "MANUAL":
        return t("pos.history.sourceManual");
      case "STOREFRONT":
        return t("pos.history.sourceStorefront");
      case "POS":
        return t("pos.history.sourcePos");
      default:
        return AGGREGATOR_LABELS[source as keyof typeof AGGREGATOR_LABELS] ?? source;
    }
  };

  const paymentMethodLabel = (method: string) => {
    switch (method) {
      case "CASH":
        return t("pos.checkout.cash");
      case "QRIS":
        return t("pos.checkout.qris");
      case "BANK_TRANSFER":
        return t("pos.markPaid.virtualAccount");
      case "STRIPE_CARD":
        return t("pos.markPaid.creditCard");
      default:
        return method;
    }
  };

  const dateParams = `from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
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
    enabled: comparePrevious,
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
      apiClient.get<{ items: TopItem[] }>(
        `${base}/top-items?${dateParams}${staffParam}${categoryParam}${departmentParam}${channelParam}${paymentMethodParam}&limit=20`
      ),
  });

  const byCategory = useQuery({
    queryKey: ["finance-by-category", storeId, from, to, staffId, channel, paymentMethod],
    queryFn: () =>
      apiClient.get<{ categories: CategoryRow[] }>(
        `${base}/by-category?${dateParams}${staffParam}${channelParam}${paymentMethodParam}`
      ),
  });

  const byDepartment = useQuery({
    queryKey: ["finance-by-department", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ departments: DepartmentRow[] }>(
        `${base}/by-department?${dateParams}${staffParam}`
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
      apiClient.get<{ rows: ScheduleShiftBucketRow[] }>(
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

  const wasteEntries = useWasteEntries(storeId, {
    from: `${from}T00:00:00Z`,
    to: `${to}T23:59:59Z`,
    take: 100,
  });

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
        if (shiftSort.sortField === "openedAt") return s.openedAt ? new Date(s.openedAt).getTime() : 0;
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

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    if (summary.data) {
      const s = summary.data;
      const rows = [
        [t("pages.financePeriod"), `${from} — ${to}`],
        [t("pages.financeOrders"), s.orderCount],
        [t("pages.financeGrossRevenue"), s.grossRevenue],
        [t("pages.financeDiscount"), s.discountAmount],
        [t("pages.financeRevenue"), s.revenue],
        [t("pages.financeRefund"), s.refundAmount],
        [t("pages.financeCogs"), s.cogs],
        [t("pages.financeGrossProfit"), s.grossProfit],
        [t("pages.financeMargin"), s.grossMarginPct],
        [t("pages.financeTax"), s.taxCollected],
        [t("pages.financeServiceCharge"), s.serviceCharge],
        [t("pages.financeProcessingFee"), s.processingFee],
        [t("pages.financeNetRevenue"), s.netRevenue],
        [t("pages.financeWasteLoss"), s.wasteLoss],
        [t("pages.financeNetProfit"), s.netProfit],
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(rows),
        t("pages.financeSummarySheet")
      );
    }

    if (byPaymentMethod.data?.methods?.length) {
      const header = [
        t("pages.financePaymentMethod"),
        t("pages.financeOrders"),
        t("pages.financeRevenue"),
        "%",
      ];
      const rows = byPaymentMethod.data.methods.map((m) => [
        paymentMethodLabel(m.paymentMethod),
        m.orderCount,
        m.revenue,
        m.percentOfTotal,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financePaymentMethod")
      );
    }

    if (itemMargin.data?.items?.length) {
      const header = [
        t("common.name"),
        t("pages.financeQtySold"),
        t("pages.financeRevenue"),
        t("pages.financeCost"),
        t("pages.financeMarginAmount"),
        t("pages.financeMargin"),
      ];
      const rows = itemMargin.data.items.map((i) => [
        i.name,
        i.totalQuantity,
        i.totalRevenue,
        i.totalCost ?? "—",
        i.margin ?? "—",
        i.marginPct != null ? `${i.marginPct}%` : "—",
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeItemMargin")
      );
    }

    if (cashReconciliation.data?.shifts?.length) {
      const header = [
        t("pages.financeCashier"),
        t("pages.financeShiftPeriod"),
        t("pages.financeOpeningCash"),
        t("pages.financeClosingCash"),
        t("pages.financeExpectedCash"),
        t("pages.financeCashDifference"),
      ];
      const rows = cashReconciliation.data.shifts.map((row) => [
        row.staffName,
        `${formatDateTime(row.openedAt)}${row.closedAt ? ` — ${formatDateTime(row.closedAt)}` : ""}`,
        row.openingCash,
        row.closingCash ?? "—",
        row.expectedCash ?? "—",
        row.cashDifference ?? "—",
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeCashReconciliation")
      );
    }

    if (channels.data?.channels?.length) {
      const header = [
        t("pages.financeChannel"),
        t("pages.financeOrders"),
        t("pages.financeRevenue"),
        t("pages.financeCommission") + " (%)",
        t("pages.financeCommission"),
        t("pages.financeTax"),
        t("pages.financeProcessingFee"),
        t("pages.financeNetRevenue"),
      ];
      const rows = channels.data.channels.map((c) => [
        c.label,
        c.orderCount,
        c.revenue,
        c.commissionPct,
        c.commissionAmount,
        c.taxAmount,
        c.processingFeeAmount,
        c.netRevenue,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeChannels")
      );
    }

    if (topItems.data?.items?.length) {
      const header = [
        t("common.item"),
        t("pages.financeOrders"),
        t("pages.financeQtySold"),
        t("pages.financeRevenue"),
      ];
      const rows = topItems.data.items.map((i) => [
        i.name,
        i.orderCount,
        i.totalQuantity,
        i.totalRevenue,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeTopItems")
      );
    }

    if (byCategory.data?.categories?.length) {
      const header = [
        t("pages.financeCategory"),
        t("pages.financeQtySold"),
        t("pages.financeRevenue"),
      ];
      const rows = byCategory.data.categories.map((c) => [
        c.categoryName,
        c.totalQuantity,
        c.totalRevenue,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeByCategory")
      );
    }

    if (byDepartment.data?.departments?.length) {
      const header = [
        t("common.department"),
        t("pages.financeQtySold"),
        t("pages.financeRevenue"),
      ];
      const rows = byDepartment.data.departments.map((d) => [
        d.department === "KITCHEN"
          ? t("common.departmentKitchen")
          : d.department === "BAR"
            ? t("common.departmentBar")
            : t("common.departmentUnassigned"),
        d.totalQuantity,
        d.totalRevenue,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeDepartmentSplit")
      );
    }

    if (byShift.data?.shifts?.length) {
      const header = [
        t("pages.financeCashier"),
        t("pages.financeShiftPeriod"),
        t("pages.financeOrders"),
        t("pages.financeRevenue"),
      ];
      const rows = byShift.data.shifts.map((s) => [
        s.staffName,
        s.openedAt
          ? `${formatDateTime(s.openedAt)} — ${s.closedAt ? formatDateTime(s.closedAt) : "—"}`
          : "—",
        s.orderCount,
        s.revenue,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeByShift")
      );
    }

    if (byScheduleShift.data?.rows?.length) {
      const header = [
        t("pages.financeScheduleShiftBlock"),
        t("common.date") || "Date",
        t("pages.financeOrders"),
        t("pages.financeRevenue"),
        t("pages.financeStaffOnDuty"),
      ];
      const rows = byScheduleShift.data.rows.map((r) => [
        r.name,
        r.date,
        r.orderCount,
        r.revenue,
        r.staffOnDuty.map((s) => s.name).join(", "),
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeScheduleShiftBlock")
      );
    }

    if (wasteEntries.data?.entries?.length) {
      const header = [
        t("waste.table.date") || "Date",
        t("waste.table.item") || "Item",
        t("waste.table.reason") || "Reason",
        t("waste.table.quantity") || "Quantity",
        t("waste.table.unitCost") || "Unit cost",
        t("waste.table.totalValue") || "Total value",
        t("waste.table.notes") || "Notes",
      ];
      const rows = wasteEntries.data.entries.map((entry) => [
        formatDateTime(entry.createdAt),
        entry.material?.name ?? entry.product?.name ?? "—",
        entry.reason === "OTHER" ? (entry.customReason ?? entry.reason) : entry.reason,
        entry.quantity,
        entry.unitCostSnapshot,
        entry.totalValue,
        entry.notes ?? "",
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("pages.financeWaste") || "Waste"
      );
    }

    XLSX.writeFile(wb, `finance-report-${from}-${to}.xlsx`);
  }

  function openPrintView() {
    const params = new URLSearchParams({ from, to });
    if (staffId !== ALL) params.set("staffId", staffId);
    if (categoryId !== ALL) params.set("category", categoryId);
    if (department !== ALL) params.set("department", department);
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
  const sPrev = comparePrevious ? summaryPrevious.data : undefined;

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
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pages.financeTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pages.financeDesc")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {showOwnerLink && (
            <Button size="sm" variant="outline" onClick={() => router.push("/owner")}>
              <Store className="mr-2 h-4 w-4" />
              {t("pages.financeAllOutlets")}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0">
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="finance-date-range">{t("common.datePicker.dateRange")}</Label>
          <DateRangeField
            id="finance-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => setDateRange(nextFrom, nextTo)}
          />
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
      </div>
      {comparePrevious && (
        <p className="text-muted-foreground text-xs">
          {t("pages.financeComparePreviousHint")
            .replace("{from}", previousRange.from)
            .replace("{to}", previousRange.to)}
        </p>
      )}

      {/* KPI cards */}
      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
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
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">{formatOrderPrice(s.revenue)}</p>
                <DeltaBadge metricKey="revenue" />
              </div>
              <p className="text-muted-foreground text-xs">
                {s.orderCount} {t("pages.financeOrders")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeCogs")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatOrderPrice(s.cogs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeGrossProfit")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">{formatOrderPrice(s.grossProfit)}</p>
                <DeltaBadge metricKey="grossProfit" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeMargin")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.grossMarginPct.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeTax")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatOrderPrice(s.taxCollected)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeProcessingFee")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatOrderPrice(s.processingFee)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeNetRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatOrderPrice(s.netRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeWasteLoss")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatOrderPrice(s.wasteLoss)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeNetProfit")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">{formatOrderPrice(s.netProfit)}</p>
                <DeltaBadge metricKey="netProfit" />
              </div>
            </CardContent>
          </Card>
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
            <div className="flex flex-wrap gap-6">
              {(byDepartment.data?.departments ?? []).map((d) => (
                <div key={d.department ?? "unassigned"} className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">
                    {d.department === "KITCHEN"
                      ? t("common.departmentKitchen")
                      : d.department === "BAR"
                        ? t("common.departmentBar")
                        : t("common.departmentUnassigned")}
                  </p>
                  <p className="text-xl font-bold">{formatOrderPrice(d.totalRevenue)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="pl">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="pl">{t("pages.financePLStatement")}</TabsTrigger>
          <TabsTrigger value="channels">{t("pages.financeChannels")}</TabsTrigger>
          <TabsTrigger value="paymentMethod">{t("pages.financePaymentMethod")}</TabsTrigger>
          <TabsTrigger value="items">{t("pages.financeTopItems")}</TabsTrigger>
          <TabsTrigger value="margin">{t("pages.financeItemMargin")}</TabsTrigger>
          <TabsTrigger value="category">{t("pages.financeByCategory")}</TabsTrigger>
          <TabsTrigger value="shift">{t("pages.financeByShift")}</TabsTrigger>
            <TabsTrigger value="scheduleShift">{t("pages.financeScheduleShiftBlock")}</TabsTrigger>
          <TabsTrigger value="cash">{t("pages.financeCashReconciliation")}</TabsTrigger>
          <TabsTrigger value="daily">{t("pages.financeDaily")}</TabsTrigger>
          <TabsTrigger value="waste">{t("pages.financeWaste")}</TabsTrigger>
        </TabsList>

        {/* P&L Statement — top-to-bottom accountant-style income statement,
            same numbers as the KPI cards restructured into one readable
            waterfall, with period-over-period deltas when comparePrevious
            is on. */}
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
            <div className="max-w-lg space-y-0.5 text-sm">
              {(
                [
                  { label: t("pages.financeGrossRevenue"), value: s.grossRevenue, key: "grossRevenue" as const },
                  { label: t("pages.financeDiscount"), value: -s.discountAmount, key: null },
                  {
                    label: t("pages.financeNetSales"),
                    value: s.revenue,
                    key: "revenue" as const,
                    strong: true,
                    borderTop: true,
                  },
                  { label: t("pages.financeRefund"), value: -s.refundAmount, key: null },
                  { label: t("pages.financeCogs"), value: -s.cogs, key: null },
                  {
                    label: t("pages.financeGrossProfit"),
                    value: s.grossProfit,
                    key: "grossProfit" as const,
                    strong: true,
                    borderTop: true,
                  },
                  { label: t("pages.financeWasteLoss"), value: -s.wasteLoss, key: null },
                  { label: t("pages.financeProcessingFee"), value: -s.processingFee, key: null },
                  {
                    label: t("pages.financeNetProfit"),
                    value: s.netProfit,
                    key: "netProfit" as const,
                    strong: true,
                    borderTop: true,
                  },
                ] satisfies {
                  label: string;
                  value: number;
                  key: keyof SummaryData | null;
                  strong?: boolean;
                  borderTop?: boolean;
                }[]
              ).map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between py-1.5 ${row.borderTop ? "border-t pt-2" : ""} ${row.strong ? "font-semibold" : "text-muted-foreground"}`}
                >
                  <span className={row.strong ? "text-foreground" : undefined}>{row.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={row.strong ? "text-foreground" : undefined}>
                      {formatOrderPrice(row.value)}
                    </span>
                    {row.key && <DeltaBadge metricKey={row.key} />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Channels tab */}
        <TabsContent value="channels">
          <div className="space-y-3 lg:hidden">
            {channels.isLoading || channels.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={channels.isError}
                  onRetry={() => channels.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              sortedChannels.map((c) => (
                <div key={c.source} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground text-sm">
                      {c.orderCount} {t("pages.financeOrders")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeRevenue")}</span>
                    <span>{formatOrderPrice(c.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeCommission")}</span>
                    <span className="text-orange-600">
                      {c.commissionPct > 0
                        ? `-${c.commissionPct}% (${formatOrderPrice(c.commissionAmount)})`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("pages.financeProcessingFee")}
                    </span>
                    <span className="text-orange-600">
                      {c.processingFeeAmount > 0 ? `-${formatOrderPrice(c.processingFeeAmount)}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeNetRevenue")}</span>
                    <span>{formatOrderPrice(c.netRevenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[680px]">
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
                    <TableHead className="text-right">{t("pages.financeCommission")}</TableHead>
                    <TableHead className="text-right">
                      {t("pages.financeProcessingFee")}
                    </TableHead>
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
                      colSpan={6}
                      onRetry={() => channels.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedChannels.map((c) => (
                      <TableRow key={c.source}>
                        <TableCell className="font-medium">{c.label}</TableCell>
                        <TableCell className="text-right">{c.orderCount}</TableCell>
                        <TableCell className="text-right">{formatOrderPrice(c.revenue)}</TableCell>
                        <TableCell className="text-right text-orange-600">
                          {c.commissionPct > 0
                            ? `-${c.commissionPct}% (${formatOrderPrice(c.commissionAmount)})`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {c.processingFeeAmount > 0
                            ? `-${formatOrderPrice(c.processingFeeAmount)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatOrderPrice(c.netRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Payment method breakdown tab */}
        <TabsContent value="paymentMethod">
          <div className="space-y-3 lg:hidden">
            {byPaymentMethod.isLoading || byPaymentMethod.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={byPaymentMethod.isError}
                  onRetry={() => byPaymentMethod.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              sortedPaymentMethods.map((m) => (
                <div key={m.paymentMethod} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{paymentMethodLabel(m.paymentMethod)}</span>
                    <span className="text-muted-foreground text-sm">
                      {m.orderCount} {t("pages.financeOrders")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeRevenue")}</span>
                    <span>
                      {formatOrderPrice(m.revenue)} ({m.percentOfTotal}%)
                    </span>
                  </div>
                </div>
              ))
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
                      {t("pages.financeOrders")}
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
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedPaymentMethods.map((m) => (
                      <TableRow key={m.paymentMethod}>
                        <TableCell className="font-medium">
                          {paymentMethodLabel(m.paymentMethod)}
                        </TableCell>
                        <TableCell className="text-right">{m.orderCount}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatOrderPrice(m.revenue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {m.percentOfTotal}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Top items tab */}
        <TabsContent value="items">
          <div className="space-y-3 lg:hidden">
            {topItems.isLoading || topItems.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={topItems.isError}
                  onRetry={() => topItems.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              sortedItems.map((item, i) => (
                <div key={item.name} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{i + 1}</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeQtySold")}</span>
                    <span>{item.totalQuantity}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeRevenue")}</span>
                    <span>{formatOrderPrice(item.totalRevenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[400px]">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.isLoading || topItems.isError ? (
                    <ReportStatusRow
                      isError={topItems.isError}
                      colSpan={4}
                      onRetry={() => topItems.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedItems.map((item, i) => (
                      <TableRow key={item.name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{item.totalQuantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatOrderPrice(item.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Menu item / recipe margin tab */}
        <TabsContent value="margin">
          <p className="text-muted-foreground mb-3 text-xs">{t("pages.financeUnknownCostHint")}</p>
          <div className="space-y-3 lg:hidden">
            {itemMargin.isLoading || itemMargin.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={itemMargin.isError}
                  onRetry={() => itemMargin.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              sortedMarginItems.map((item) => (
                <div key={item.name} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {item.totalQuantity} {t("pages.financeQtySold")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeRevenue")}</span>
                    <span>{formatOrderPrice(item.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeCost")}</span>
                    <span>{item.totalCost != null ? formatOrderPrice(item.totalCost) : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeMarginAmount")}</span>
                    <span>
                      {item.margin != null
                        ? `${formatOrderPrice(item.margin)} (${item.marginPct}%)`
                        : "—"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[560px]">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemMargin.isLoading || itemMargin.isError ? (
                    <ReportStatusRow
                      isError={itemMargin.isError}
                      colSpan={5}
                      onRetry={() => itemMargin.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedMarginItems.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{formatOrderPrice(item.totalRevenue)}</TableCell>
                        <TableCell className="text-right">
                          {item.totalCost != null ? formatOrderPrice(item.totalCost) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {item.margin != null ? formatOrderPrice(item.margin) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.marginPct != null ? `${item.marginPct}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* By category tab */}
        <TabsContent value="category">
          <div className="space-y-3 lg:hidden">
            {byCategory.isLoading || byCategory.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={byCategory.isError}
                  onRetry={() => byCategory.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              sortedCategories.map((c) => (
                <div
                  key={c.categoryId ?? "none"}
                  className="bg-muted/50 space-y-2 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {c.categoryId ? c.categoryName : t("pages.financeUncategorized")}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {c.orderItemCount} {t("pages.financeOrders")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeQtySold")}</span>
                    <span>{c.totalQuantity}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeRevenue")}</span>
                    <span>{formatOrderPrice(c.totalRevenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[480px]">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.isLoading || byCategory.isError ? (
                    <ReportStatusRow
                      isError={byCategory.isError}
                      colSpan={4}
                      onRetry={() => byCategory.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedCategories.map((c) => (
                      <TableRow key={c.categoryId ?? "none"}>
                        <TableCell className="font-medium">
                          {c.categoryId ? c.categoryName : t("pages.financeUncategorized")}
                        </TableCell>
                        <TableCell className="text-right">{c.orderItemCount}</TableCell>
                        <TableCell className="text-right">{c.totalQuantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatOrderPrice(c.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* By shift tab — the "total sales from open to close" report */}
        <TabsContent value="shift">
          <div className="space-y-3 lg:hidden">
            {byShift.isLoading || byShift.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={byShift.isError}
                  onRetry={() => byShift.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              sortedShifts.map((sh) => (
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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeOrders")}</span>
                    <span>{sh.orderCount}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeRevenue")}</span>
                    <span>{formatOrderPrice(sh.revenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[560px]">
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
                      colSpan={4}
                      onRetry={() => byShift.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedShifts.map((sh) => (
                      <TableRow key={sh.shiftId ?? "unassigned"}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {sh.shiftId ? sh.staffName : t("pages.financeUnassigned")}
                            {sh.shiftId && (
                              <Badge variant={sh.isOpen ? "default" : "outline"} className="text-xs">
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
                        <TableCell className="text-right">{sh.orderCount}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatOrderPrice(sh.revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Revenue per named shift-block ("Shift 1", etc.) — a coverage-window
            report, not a partition: blocks can overlap by design (staggered
            handover coverage), so totals across rows are NOT expected to sum
            to the grand total. */}
        <TabsContent value="scheduleShift">
          <p className="text-muted-foreground mb-3 text-xs">
            {t("pages.financeScheduleShiftOverlapNote")}
          </p>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[640px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pages.financeScheduleShiftBlock")}</TableHead>
                    <TableHead>{t("common.date") || "Date"}</TableHead>
                    <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                    <TableHead>{t("pages.financeStaffOnDuty")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byScheduleShift.isLoading || byScheduleShift.isError ? (
                    <ReportStatusRow
                      isError={byScheduleShift.isError}
                      colSpan={5}
                      onRetry={() => byScheduleShift.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (byScheduleShift.data?.rows.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        {t("common.noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    byScheduleShift.data!.rows
                      .filter((r) => r.orderCount > 0)
                      .map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="flex items-center gap-2 font-medium">
                            {r.color && (
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: r.color }}
                              />
                            )}
                            {r.name}
                          </TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell className="text-right">{r.orderCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatOrderPrice(r.revenue)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {r.staffOnDuty.map((s) => s.name).join(", ") || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Cash-drawer reconciliation tab — flags a closed shift whose
            closingCash didn't match expectedCash. */}
        <TabsContent value="cash">
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
              sortedCashRows.map((row) => (
                <div key={row.shiftId} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{row.staffName}</span>
                    <div className="flex gap-1.5">
                      <Badge variant={row.isOpen ? "default" : "outline"}>
                        {row.isOpen
                          ? t("pages.financeShiftStatusOpen")
                          : t("pages.financeShiftStatusClosed")}
                      </Badge>
                      {row.isFlagged && <Badge variant="destructive">{t("pages.financeFlagged")}</Badge>}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">{formatDateTime(row.openedAt)}</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeOpeningCash")}</span>
                    <span>{formatOrderPrice(row.openingCash)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeClosingCash")}</span>
                    <span>{row.closingCash != null ? formatOrderPrice(row.closingCash) : "—"}</span>
                  </div>
                  <div
                    className={`flex justify-between text-sm font-semibold ${row.isFlagged ? "text-destructive" : ""}`}
                  >
                    <span className="text-muted-foreground">{t("pages.financeCashDifference")}</span>
                    <span>{row.cashDifference != null ? formatOrderPrice(row.cashDifference) : "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[680px]">
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
                    <TableHead className="text-right">{t("pages.financeClosingCash")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeExpectedCash")}</TableHead>
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
                      colSpan={6}
                      onRetry={() => cashReconciliation.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedCashRows.map((row) => (
                      <TableRow key={row.shiftId} className={row.isFlagged ? "bg-destructive/5" : undefined}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
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
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateTime(row.openedAt)}
                          {row.closedAt ? ` — ${formatDateTime(row.closedAt)}` : ""}
                        </TableCell>
                        <TableCell className="text-right">{formatOrderPrice(row.openingCash)}</TableCell>
                        <TableCell className="text-right">
                          {row.closingCash != null ? formatOrderPrice(row.closingCash) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.expectedCash != null ? formatOrderPrice(row.expectedCash) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${row.isFlagged ? "text-destructive" : ""}`}
                        >
                          {row.cashDifference != null ? formatOrderPrice(row.cashDifference) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Daily breakdown tab */}
        <TabsContent value="daily">
          <div className="space-y-3 lg:hidden">
            {summary.isLoading || summary.isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                <ReportStatus
                  isError={summary.isError}
                  onRetry={() => summary.refetch()}
                  loadingLabel="Loading..."
                  errorLabel={t("pages.financeLoadError")}
                  retryLabel={t("common.actions.retry")}
                />
              </p>
            ) : (
              (s?.buckets ?? []).map((b) => (
                <div
                  key={b.date}
                  className="bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
                >
                  <span className="font-medium">{b.date}</span>
                  <span>{formatOrderPrice(b.revenue)}</span>
                </div>
              ))
            )}
          </div>
          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
            <div className="min-w-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.isLoading || summary.isError ? (
                    <ReportStatusRow
                      isError={summary.isError}
                      colSpan={2}
                      onRetry={() => summary.refetch()}
                      loadingLabel="Loading..."
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    (s?.buckets ?? []).map((b) => (
                      <TableRow key={b.date}>
                        <TableCell>{b.date}</TableCell>
                        <TableCell className="text-right">{formatOrderPrice(b.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Waste tab — itemized loss with inline correction (edit/delete) */}
        <TabsContent value="waste" className="space-y-4">
          {(wasteByReason.data?.reasons.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {(wasteByReason.data?.reasons ?? []).map((r) => (
                <Badge key={r.reason + r.label} variant="outline" className="gap-1.5 py-1.5">
                  <span>{r.label}</span>
                  <span className="text-muted-foreground">{formatPrice(r.totalValue)}</span>
                </Badge>
              ))}
            </div>
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
                      {entry.reason === "OTHER" ? (entry.customReason ?? entry.reason) : entry.reason}
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
            <AlertDialogTitle>{t("waste.deleteConfirm.title") || "Delete waste entry?"}</AlertDialogTitle>
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
