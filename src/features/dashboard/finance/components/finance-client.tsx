"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { formatDateTime } from "@/lib/utils/formatting";
import { Download, FileText, Sheet, Pencil, Trash2 } from "lucide-react";
import { useSortable, sortRows } from "@/features/dashboard/shared/hooks/use-sortable";
import { SortIcon } from "@/features/dashboard/shared/components/sort-icon";
import { DateRangeField } from "@/components/ui/date-range-field";
import { todayLocalISO, startOfMonthLocalISO } from "@/lib/utils/date-range";
import { WasteFormDialog } from "@/features/dashboard/management/waste/waste-form-dialog";
import {
  useWasteEntries,
  useDeleteWasteEntry,
  type WasteEntryWithRelations,
} from "@/features/dashboard/management/waste/hooks/use-waste";

interface SummaryData {
  from: string;
  to: string;
  revenue: number;
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
}

const ALL = "all";

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

export function FinanceClient({ storeId, staff, categories }: FinanceClientProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const [from, setFrom] = useState(startOfMonthLocalISO());
  const [to, setTo] = useState(todayLocalISO());
  const [staffId, setStaffId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [department, setDepartment] = useState(ALL);

  const dateParams = `from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
  const staffParam = staffId !== ALL ? `&staffId=${staffId}` : "";
  const categoryParam = categoryId !== ALL ? `&category=${categoryId}` : "";
  const departmentParam = department !== ALL ? `&department=${department}` : "";
  const base = `/stores/${storeId}/finance`;

  const summary = useQuery({
    queryKey: ["finance-summary", storeId, from, to, staffId],
    queryFn: () => apiClient.get<SummaryData>(`${base}/summary?${dateParams}${staffParam}`),
  });

  const channels = useQuery({
    queryKey: ["finance-channels", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ channels: ChannelRow[] }>(`${base}/channels?${dateParams}${staffParam}`),
  });

  const topItems = useQuery({
    queryKey: ["finance-top-items", storeId, from, to, staffId, categoryId, department],
    queryFn: () =>
      apiClient.get<{ items: TopItem[] }>(
        `${base}/top-items?${dateParams}${staffParam}${categoryParam}${departmentParam}&limit=20`
      ),
  });

  const byCategory = useQuery({
    queryKey: ["finance-by-category", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ categories: CategoryRow[] }>(`${base}/by-category?${dateParams}${staffParam}`),
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

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    if (summary.data) {
      const s = summary.data;
      const rows = [
        [t("pages.financePeriod"), `${from} — ${to}`],
        [t("pages.financeOrders"), s.orderCount],
        [t("pages.financeRevenue"), s.revenue],
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="finance-date-range">{t("common.datePicker.dateRange")}</Label>
          <DateRangeField
            id="finance-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
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
      </div>

      {/* KPI cards */}
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(s.revenue)}</p>
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
              <p className="text-2xl font-bold">{formatPrice(s.cogs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeGrossProfit")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(s.grossProfit)}</p>
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
              <p className="text-2xl font-bold">{formatPrice(s.taxCollected)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeProcessingFee")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(s.processingFee)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeNetRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(s.netRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeWasteLoss")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatPrice(s.wasteLoss)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t("pages.financeNetProfit")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(s.netProfit)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Department split — the "Kitchen vs Bar" daily report */}
      {(byDepartment.data?.departments.length ?? 0) > 0 && (
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
                  <p className="text-xl font-bold">{formatPrice(d.totalRevenue)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="channels">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="channels">{t("pages.financeChannels")}</TabsTrigger>
          <TabsTrigger value="items">{t("pages.financeTopItems")}</TabsTrigger>
          <TabsTrigger value="category">{t("pages.financeByCategory")}</TabsTrigger>
          <TabsTrigger value="shift">{t("pages.financeByShift")}</TabsTrigger>
            <TabsTrigger value="scheduleShift">{t("pages.financeScheduleShiftBlock")}</TabsTrigger>
          <TabsTrigger value="daily">{t("pages.financeDaily")}</TabsTrigger>
          <TabsTrigger value="waste">{t("pages.financeWaste")}</TabsTrigger>
        </TabsList>

        {/* Channels tab */}
        <TabsContent value="channels">
          <div className="space-y-3 lg:hidden">
            {channels.isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
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
                    <span>{formatPrice(c.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("pages.financeCommission")}</span>
                    <span className="text-orange-600">
                      {c.commissionPct > 0
                        ? `-${c.commissionPct}% (${formatPrice(c.commissionAmount)})`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("pages.financeProcessingFee")}
                    </span>
                    <span className="text-orange-600">
                      {c.processingFeeAmount > 0 ? `-${formatPrice(c.processingFeeAmount)}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">{t("pages.financeNetRevenue")}</span>
                    <span>{formatPrice(c.netRevenue)}</span>
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
                  {channels.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedChannels.map((c) => (
                      <TableRow key={c.source}>
                        <TableCell className="font-medium">{c.label}</TableCell>
                        <TableCell className="text-right">{c.orderCount}</TableCell>
                        <TableCell className="text-right">{formatPrice(c.revenue)}</TableCell>
                        <TableCell className="text-right text-orange-600">
                          {c.commissionPct > 0
                            ? `-${c.commissionPct}% (${formatPrice(c.commissionAmount)})`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {c.processingFeeAmount > 0
                            ? `-${formatPrice(c.processingFeeAmount)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(c.netRevenue)}
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
            {topItems.isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
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
                    <span>{formatPrice(item.totalRevenue)}</span>
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
                  {topItems.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedItems.map((item, i) => (
                      <TableRow key={item.name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{item.totalQuantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(item.totalRevenue)}
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
            {byCategory.isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
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
                    <span>{formatPrice(c.totalRevenue)}</span>
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
                  {byCategory.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCategories.map((c) => (
                      <TableRow key={c.categoryId ?? "none"}>
                        <TableCell className="font-medium">
                          {c.categoryId ? c.categoryName : t("pages.financeUncategorized")}
                        </TableCell>
                        <TableCell className="text-right">{c.orderItemCount}</TableCell>
                        <TableCell className="text-right">{c.totalQuantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(c.totalRevenue)}
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
            {byShift.isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
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
                    <span>{formatPrice(sh.revenue)}</span>
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
                  {byShift.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
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
                          {formatPrice(sh.revenue)}
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
                  {byScheduleShift.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
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
                            {formatPrice(r.revenue)}
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

        {/* Daily breakdown tab */}
        <TabsContent value="daily">
          <div className="space-y-3 lg:hidden">
            {summary.isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
            ) : (
              (s?.buckets ?? []).map((b) => (
                <div
                  key={b.date}
                  className="bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
                >
                  <span className="font-medium">{b.date}</span>
                  <span>{formatPrice(b.revenue)}</span>
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
                  {summary.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground py-8 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    (s?.buckets ?? []).map((b) => (
                      <TableRow key={b.date}>
                        <TableCell>{b.date}</TableCell>
                        <TableCell className="text-right">{formatPrice(b.revenue)}</TableCell>
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
            {wasteEntries.isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
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
                  {wasteEntries.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
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
