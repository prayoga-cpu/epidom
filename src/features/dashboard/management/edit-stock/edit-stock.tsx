"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ExportButton } from "@/components/ui/export-button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useDialogSwap } from "@/components/ui/use-dialog-swap";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMaterials, useUpdateMaterial } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useProducts } from "@/features/dashboard/data/products/hooks/use-products";
import { useStockAdjustment } from "./hooks/use-stock-adjustment";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { FilterBar } from "@/features/dashboard/shared/components/filter-bar";
import {
  ViewModeToggle,
  isViewMode,
  type ViewMode,
} from "@/features/dashboard/shared/components/view-mode-toggle";
import { sortRows, type SortDir } from "@/features/dashboard/shared/hooks/use-sortable";
import {
  Package,
  History,
  Upload,
  Edit3,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  CalendarIcon,
  ArrowUpDown,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { BulkAdjustmentDialog } from "./bulk-adjustment-dialog";
import { AdjustmentHistoryDialog } from "./adjustment-history-dialog";
import { CSVImportDialog } from "./csv-import-dialog";
import { WasteFormDialog } from "../waste/waste-form-dialog";
import { useCurrency } from "@/components/providers/currency-provider";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ItemType = "material" | "product";
type StatusFilter = "all" | "oversold" | "low" | "overstock" | "in-stock";
type ExpirationFilter = "any" | "expired" | "soon" | "month";
type SortField = "name" | "stock" | "expiration";

interface StockItem {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  costPerUnit: number;
  type: ItemType;
  expirationDate: string | null;
}

interface StockFilters {
  status: StatusFilter;
  category: string;
  expiration: ExpirationFilter;
  sortField: SortField;
  sortDir: SortDir;
  view: ViewMode;
}

const STOCK_FILTER_DEFAULTS: StockFilters = {
  status: "all",
  category: "all",
  expiration: "any",
  sortField: "name",
  sortDir: "asc",
  view: "grid",
};

const ITEMS_LAYOUT_CLASS: Record<ViewMode, string> = {
  // Two columns on a phone; from `sm` up, as many columns of at least the
  // minimum width as the content area fits, so the cards track the space
  // left beside the sidebar rather than the viewport.
  grid: "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
  columns: "grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]",
  list: "flex flex-col gap-2",
};

function sanitizeStockFilters(raw: unknown, defaults: StockFilters): StockFilters {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<StockFilters>;
  return {
    status: (["all", "oversold", "low", "overstock", "in-stock"] as const).includes(
      r.status as StatusFilter
    )
      ? (r.status as StatusFilter)
      : "all",
    category: typeof r.category === "string" ? r.category : "all",
    expiration: (["any", "expired", "soon", "month"] as const).includes(
      r.expiration as ExpirationFilter
    )
      ? (r.expiration as ExpirationFilter)
      : "any",
    sortField: (["name", "stock", "expiration"] as const).includes(r.sortField as SortField)
      ? (r.sortField as SortField)
      : "name",
    sortDir: r.sortDir === "desc" ? "desc" : "asc",
    view: isViewMode(r.view) ? r.view : "grid",
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

type DetailsLayer = "adjust" | "bulk" | "waste" | "history" | "reset";

export function EditStockCard() {
  const { t, dateLocale, formatDate } = useI18n();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params?.storeId as string;
  const { advancedReportsAccess } = useFeatureAccess();

  const [filters, setFilters] = usePersistedState<StockFilters>(
    `epidom-stock-filters-${storeId}`,
    STOCK_FILTER_DEFAULTS,
    sanitizeStockFilters
  );

  const [searchQuery, setSearchQuery] = useState("");
  // The item the details dialog shows. It outlives the dialog on purpose: the
  // content stays put through the close animation, and the tile keeps its
  // "last viewed" ring so the user can find their place in the grid again.
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [wasteItemId, setWasteItemId] = useState<string | undefined>(undefined);
  const [wasteItemType, setWasteItemType] = useState<ItemType>("material");
  const [expirationPopoverOpen, setExpirationPopoverOpen] = useState(false);
  // Every dialog the details dialog opens swaps it out instead of stacking on
  // top of it. The toolbar's Record Waste and Bulk Adjust reuse the same
  // layers with the details dialog closed, so nothing comes back after them.
  const swap = useDialogSwap<DetailsLayer>(detailsOpen);

  // New keys ship in a separate locale change; `t()` echoes the key back when
  // it is missing, so fall back to English rather than render a raw key path.
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  // take: 100 (the API's max page size) so this list — unlike the paginated
  // Data > Materials grid — shows every item in one shot instead of silently
  // capping at the 50-row default (this screen has no page-2 control).
  const { data: materialsData, isLoading: isLoadingMaterials } = useMaterials(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    skip: 0,
    take: 100,
  });
  // Finished goods live here too — this is the only surface where product
  // shrinkage (and oversell) becomes visible.
  const { data: productsData, isLoading: isLoadingProducts } = useProducts(storeId, {
    productLine: "STANDARD",
    sortBy: "name",
    sortOrder: "asc",
    take: 100,
  });
  const isLoading = isLoadingMaterials || isLoadingProducts;
  const updateMaterial = useUpdateMaterial(storeId, selectedItemId ?? "");
  const resetStock = useStockAdjustment(storeId);

  const allStockItems: StockItem[] = useMemo(() => {
    const materialItems: StockItem[] = (materialsData?.materials ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      sku: m.sku || "",
      category: m.category ?? null,
      currentStock: Number(m.currentStock),
      minStock: Number(m.minStock),
      maxStock: Number(m.maxStock),
      unit: m.unit,
      costPerUnit: Number(m.unitCost),
      type: "material" as ItemType,
      expirationDate: m.expirationDate ? new Date(m.expirationDate).toISOString() : null,
    }));

    // Only BATCH_PRODUCED products hold a counted finished-goods balance.
    // MADE_TO_ORDER consumes raw materials per sale and UNTRACKED never moves,
    // so neither has a quantity this screen could adjust or value.
    const productItems: StockItem[] = (productsData?.products ?? [])
      .filter((p) => p.stockMode === "BATCH_PRODUCED")
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || "",
        category: p.category ?? null,
        currentStock: Number(p.currentStock),
        minStock: Number(p.minStock),
        maxStock: Number(p.maxStock),
        unit: p.unit,
        costPerUnit: Number(p.costPrice),
        type: "product" as ItemType,
        // Products track `shelfLife` (days from production), not a single
        // expiry date, so there is nothing to show or edit here.
        expirationDate: null,
      }));

    return [...materialItems, ...productItems];
  }, [materialsData, productsData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allStockItems.forEach((item) => item.category && set.add(item.category));
    return Array.from(set).sort();
  }, [allStockItems]);

  const getStockStatus = (item: StockItem) => {
    // A negative balance means more was sold/consumed than was ever counted.
    // Stock clamps were removed from the sale path on purpose, so this is the
    // honest record — and it outranks every threshold below it.
    if (item.currentStock < 0) {
      return {
        label: tr("data.products.stockStatus.oversold", "Oversold"),
        variant: "destructive" as const,
        icon: AlertTriangle,
        key: "oversold" as StatusFilter,
      };
    }
    if (item.currentStock <= item.minStock) {
      return { label: t("management.editStock.lowStock"), variant: "outline" as const, icon: AlertCircle, key: "low" as StatusFilter };
    } else if (item.currentStock > item.maxStock) {
      return { label: "Overstock", variant: "outline" as const, icon: AlertCircle, key: "overstock" as StatusFilter };
    }
    return { label: t("management.editStock.inStock"), variant: "outline" as const, icon: CheckCircle, key: "in-stock" as StatusFilter };
  };

  /** Real fill level — negative when oversold. Never feed this to a bar. */
  const getStockPercentage = (item: StockItem) => {
    if (item.maxStock === 0) return 0;
    return (item.currentStock / item.maxStock) * 100;
  };

  /**
   * Bar-safe fill. A progress bar cannot draw a negative width (Radix would
   * translate the indicator past its own track), so the bar clamps to 0–100
   * while the printed percentage keeps the real, possibly negative number.
   */
  const getStockBarValue = (item: StockItem) =>
    Math.max(0, Math.min(getStockPercentage(item), 100));

  const getExpirationState = (item: StockItem): "expired" | "soon" | "month" | null => {
    if (!item.expirationDate) return null;
    const daysLeft = (new Date(item.expirationDate).getTime() - Date.now()) / DAY_MS;
    if (daysLeft < 0) return "expired";
    if (daysLeft <= 7) return "soon";
    if (daysLeft <= 30) return "month";
    return null;
  };

  // Filter, then search, then sort
  const visibleItems = useMemo(() => {
    let items = allStockItems;

    if (filters.status !== "all") {
      items = items.filter((item) => getStockStatus(item).key === filters.status);
    }
    if (filters.category !== "all") {
      items = items.filter((item) => item.category === filters.category);
    }
    if (filters.expiration !== "any") {
      items = items.filter((item) => {
        const state = getExpirationState(item);
        if (filters.expiration === "expired") return state === "expired";
        if (filters.expiration === "soon") return state === "expired" || state === "soon";
        if (filters.expiration === "month") return state !== null;
        return true;
      });
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) => item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
      );
    }

    const getSortValue = (item: StockItem): string | number => {
      if (filters.sortField === "stock") return getStockPercentage(item);
      if (filters.sortField === "expiration")
        return item.expirationDate ? new Date(item.expirationDate).getTime() : Infinity;
      return item.name.toLowerCase();
    };
    return sortRows(items, filters.sortDir, getSortValue);
  }, [allStockItems, filters, searchQuery]);

  const filteredItems = visibleItems;

  const hasActiveFilters =
    filters.status !== "all" || filters.category !== "all" || filters.expiration !== "any";

  const clearFilters = () => {
    setFilters((prev) => ({ ...prev, status: "all", category: "all", expiration: "any" }));
  };

  const toggleSortField = (field: SortField) => {
    setFilters((prev) =>
      prev.sortField === field
        ? { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" }
        : { ...prev, sortField: field, sortDir: "asc" }
    );
  };

  const selectedItem = useMemo(
    () => allStockItems.find((item) => item.id === selectedItemId),
    [allStockItems, selectedItemId]
  );

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  const selectedStockItems = useMemo(() => {
    return allStockItems
      .filter((item) => selectedItems.includes(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        currentStock: item.currentStock,
        unit: item.unit,
        type: item.type,
      }));
  }, [allStockItems, selectedItems]);

  const handleCSVImport = () => {
    setCsvImportDialogOpen(true);
  };

  // Negative balances are exported as-is: rounding an oversell up to 0 would
  // hand the operator a spreadsheet that disagrees with the app (and with the
  // shelf). The status column names the condition so the number reads right.
  const exportData = filteredItems.map((item) => ({
    [t("common.sku")]: item.sku,
    [t("common.name")]: item.name,
    [t("common.type")]:
      item.type === "material" ? t("management.editStock.material") : t("management.editStock.product"),
    [t("management.editStock.currentStock")]: item.currentStock,
    [t("management.editStock.minStock")]: item.minStock,
    [t("management.editStock.maxStock")]: item.maxStock,
    [t("management.editStock.unit")]: item.unit,
    [t("common.cost")]: item.costPerUnit,
    [t("management.editStock.stockValue")]: item.currentStock * item.costPerUnit,
    [t("management.editStock.status")]: getStockStatus(item).label,
    [t("management.editStock.expirationDate")]: item.expirationDate ? formatDate(item.expirationDate) : "",
  }));

  const openDetails = (itemId: string) => {
    setSelectedItemId(itemId);
    setDetailsOpen(true);
  };

  const openWaste = (item?: StockItem) => {
    setWasteItemId(item?.id);
    setWasteItemType(item?.type ?? "material");
    swap.open("waste");
  };

  const handleExpirationChange = (date: Date | undefined) => {
    if (!selectedItem) return;
    updateMaterial.mutate(
      { expirationDate: date ?? null },
      {
        onSuccess: () => {
          toast({ title: t("management.editStock.expirationUpdated") });
          setExpirationPopoverOpen(false);
        },
        onError: () => {
          toast({ title: t("management.editStock.expirationUpdateFailed"), variant: "destructive" });
        },
      }
    );
  };

  // "Reset to 0" posts a single OUT adjustment for the exact current balance
  // instead of asking the operator to type it themselves — the item's own
  // ledger value is always the correct delta, so there's no precision to get
  // wrong by hand.
  const handleResetToZero = async () => {
    if (!selectedItem || selectedItem.currentStock <= 0) return;
    try {
      await resetStock.mutateAsync({
        materialId: selectedItem.type === "material" ? selectedItem.id : undefined,
        productId: selectedItem.type === "product" ? selectedItem.id : undefined,
        adjustmentType: "OUT",
        quantity: selectedItem.currentStock,
        reason: t("management.editStock.reasons.resetToZero"),
      });
      toast({ title: t("management.editStock.resetToZeroSuccess") });
      swap.close();
    } catch {
      toast({ title: t("management.editStock.resetToZeroFailed"), variant: "destructive" });
    }
  };

  const bulkLayer = swap.layerProps("bulk");

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("management.editStock.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("management.editStock.description")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterBar
            className="sm:flex-1"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("management.editStock.searchItems")}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            clearLabel={t("management.editStock.clearFilters")}
          >
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v as StatusFilter }))}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder={t("management.editStock.filterStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("management.editStock.filterAllStatuses")}</SelectItem>
                <SelectItem value="oversold">
                  {tr("data.products.stockStatus.oversold", "Oversold")}
                </SelectItem>
                <SelectItem value="low">{t("management.editStock.lowStock")}</SelectItem>
                <SelectItem value="in-stock">{t("management.editStock.inStock")}</SelectItem>
                <SelectItem value="overstock">Overstock</SelectItem>
              </SelectContent>
            </Select>

            {categories.length > 0 && (
              <Select
                value={filters.category}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v }))}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder={t("management.editStock.filterCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("management.editStock.filterAllCategories")}
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={filters.expiration}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, expiration: v as ExpirationFilter }))
              }
            >
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder={t("management.editStock.filterExpiration")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("management.editStock.filterExpirationAny")}</SelectItem>
                <SelectItem value="expired">
                  {t("management.editStock.filterExpirationExpired")}
                </SelectItem>
                <SelectItem value="soon">
                  {t("management.editStock.filterExpirationSoon")}
                </SelectItem>
                <SelectItem value="month">
                  {t("management.editStock.filterExpirationMonth")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto"
              onClick={() => openWaste()}
            >
              <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
              {t("waste.recordWaste") || "Record Waste"}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCSVImport}
                  disabled={!advancedReportsAccess}
                  className="w-full md:w-auto"
                >
                  <Upload className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("management.editStock.importCSV")}
                </Button>
              </TooltipTrigger>
              {!advancedReportsAccess && (
                <TooltipContent>
                  <p>{t("billing.advancedReportsOnly")}</p>
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ExportButton
                    data={exportData}
                    filename="stock-inventory"
                    size="sm"
                    disabled={!advancedReportsAccess}
                    className="w-full md:w-auto"
                  />
                </div>
              </TooltipTrigger>
              {!advancedReportsAccess && (
                <TooltipContent>
                  <p>{t("billing.advancedReportsOnly")}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        <div className="space-y-3">
          {/* One row from `sm` up; on a phone the sort buttons drop to a
              full-width row of their own under the count and Select All. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-muted-foreground text-sm">
              {filteredItems.length} {t("management.editStock.items")}
            </span>
            <div className="order-last flex w-full flex-wrap items-center gap-1 text-xs sm:order-none sm:w-auto">
              <span className="text-muted-foreground">Sort:</span>
              {(["name", "stock", "expiration"] as SortField[]).map((field) => (
                <Button
                  key={field}
                  variant={filters.sortField === field ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => toggleSortField(field)}
                >
                  {field === "name"
                    ? t("management.editStock.sortName")
                    : field === "stock"
                      ? t("management.editStock.sortStockLevel")
                      : t("management.editStock.sortExpiration")}
                  {filters.sortField === field && <ArrowUpDown className="ml-1 h-3 w-3" />}
                </Button>
              ))}
            </div>
            {/* Wraps under itself when Bulk Adjust, Select All and the layout
                switch don't fit one phone row (French labels are the longest). */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {selectedItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => swap.open("bulk")}
                  className="h-8 px-2 text-xs"
                >
                  {t("management.editStock.bulkAdjust")} ({selectedItems.length})
                </Button>
              )}
              {filteredItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-8 px-2 text-xs"
                >
                  {selectedItems.length === filteredItems.length
                    ? t("management.editStock.deselectAll")
                    : t("management.editStock.selectAll")}
                </Button>
              )}
              <ViewModeToggle
                value={filters.view}
                onChange={(view) => setFilters((prev) => ({ ...prev, view }))}
                label={t("management.editStock.view.label")}
                labels={{
                  grid: t("management.editStock.view.grid"),
                  columns: t("management.editStock.view.columns"),
                  list: t("management.editStock.view.list"),
                }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {searchQuery || hasActiveFilters
                  ? t("management.editStock.noItemsFound")
                  : t("management.editStock.noStockItemsYet")}
              </p>
            </div>
          ) : (
            <div data-view-mode={filters.view} className={ITEMS_LAYOUT_CLASS[filters.view]}>
              {filteredItems.map((item) => {
                const status = getStockStatus(item);
                const StatusIcon = status.icon;
                const isSelected = selectedItems.includes(item.id);
                const isOversold = status.key === "oversold";
                const isLow = item.currentStock <= item.minStock;
                const expirationState = getExpirationState(item);

                // Oversold spells itself out in a badge; every other status is
                // named for screen readers here, whether or not the icon shows.
                const statusLabel = !isOversold && <span className="sr-only">{status.label}</span>;
                const statusIcon = (
                  <>
                    <StatusIcon
                      aria-hidden
                      className={cn("h-4 w-4 shrink-0", isOversold && "text-destructive")}
                    />
                    {statusLabel}
                  </>
                );

                const flags = (isOversold || expirationState) && (
                  <div className="flex min-w-0 gap-1 overflow-hidden">
                    {isOversold && (
                      <Badge variant="destructive" className="text-xs">
                        {status.label}
                      </Badge>
                    )}
                    {expirationState && (
                      <Badge
                        variant={expirationState === "expired" ? "destructive" : "outline"}
                        className="min-w-0 shrink text-xs"
                      >
                        <span className="truncate">
                          {expirationState === "expired"
                            ? t("management.editStock.filterExpirationExpired")
                            : formatDate(item.expirationDate!)}
                        </span>
                      </Badge>
                    )}
                  </div>
                );

                const stockLevel = (percentClassName?: string) => (
                  <div className="w-full space-y-1">
                    <div
                      className={cn(
                        "flex justify-between gap-2 text-xs",
                        isOversold ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      <span className="truncate">
                        {item.currentStock} / {item.maxStock} {item.unit}
                      </span>
                      <span className={cn("shrink-0", percentClassName)}>
                        {Math.round(getStockPercentage(item))}%
                      </span>
                    </div>
                    <Progress
                      value={getStockBarValue(item)}
                      className={`h-1.5 ${isLow || isOversold ? "bg-muted [&>div]:bg-red-600" : "bg-muted [&>div]:bg-emerald-600"}`}
                    />
                  </div>
                );

                // A 40px hit area around the 16px box. Clicking the label
                // forwards the click to the checkbox, and the label is a
                // sibling of the item's button, so it never opens details.
                const checkbox = (className: string) => (
                  <label
                    className={cn(
                      "flex size-10 shrink-0 cursor-pointer items-center justify-center",
                      className
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItemSelection(item.id)}
                      aria-label={item.name}
                    />
                  </label>
                );

                const frameClass = cn(
                  "bg-card hover:border-primary/50 relative rounded-lg border transition-colors",
                  isSelected && "bg-muted/50",
                  selectedItemId === item.id && "border-primary"
                );
                const buttonClass =
                  "focus-visible:ring-ring rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none";

                if (filters.view === "list") {
                  return (
                    <div
                      key={item.id}
                      data-testid="stock-tile"
                      className={cn(frameClass, "flex items-center")}
                    >
                      {checkbox("ml-1")}
                      <button
                        type="button"
                        onClick={() => openDetails(item.id)}
                        className={cn(
                          buttonClass,
                          "flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-3"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          {/* On a phone a badge takes the SKU's place: the
                              row is too narrow for both, and the details
                              pop-up still shows the SKU. */}
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p
                              className={cn(
                                "text-muted-foreground min-w-0 truncate text-xs",
                                flags && "hidden sm:block"
                              )}
                            >
                              {item.sku}
                            </p>
                            {flags}
                          </div>
                        </div>
                        <Badge variant="secondary" className="hidden text-xs md:inline-flex">
                          {item.type === "material"
                            ? t("management.editStock.material")
                            : t("management.editStock.product")}
                        </Badge>
                        {/* The bar carries the level on a phone, so the
                            numbers get the room the percentage would take. */}
                        <div className="w-24 shrink-0 sm:w-40">
                          {stockLevel("hidden sm:inline")}
                        </div>
                        {statusIcon}
                      </button>
                    </div>
                  );
                }

                if (filters.view === "columns") {
                  return (
                    <div key={item.id} data-testid="stock-tile" className={frameClass}>
                      <button
                        type="button"
                        onClick={() => openDetails(item.id)}
                        className={cn(buttonClass, "flex h-full w-full flex-col gap-2 p-2.5")}
                      >
                        {/* pl-7 keeps the name clear of the checkbox, which
                            sits over this corner as a sibling of the button. */}
                        {/* No status icon in this compact tile: the bar's
                            colour and the badges carry the status, and the
                            name gets the room instead. */}
                        <p className="line-clamp-2 w-full pl-7 text-sm leading-tight font-medium break-words">
                          {item.name}
                          {statusLabel}
                        </p>
                        <div className="mt-auto w-full space-y-1">
                          {flags}
                          {stockLevel()}
                        </div>
                      </button>
                      {checkbox("absolute top-0 left-0")}
                    </div>
                  );
                }

                return (
                  <div key={item.id} data-testid="stock-tile" className={frameClass}>
                    <button
                      type="button"
                      onClick={() => openDetails(item.id)}
                      className={cn(buttonClass, "flex h-full w-full flex-col p-3")}
                    >
                      {/* pl-6 keeps the badge clear of the checkbox, which
                          sits over this corner as a sibling of the button. */}
                      <div className="flex min-h-6 w-full items-center justify-between gap-2 pl-6">
                        <Badge variant="secondary" className="min-w-0 shrink text-xs">
                          <span className="truncate">
                            {item.type === "material"
                              ? t("management.editStock.material")
                              : t("management.editStock.product")}
                          </span>
                        </Badge>
                        {statusIcon}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-5 font-medium break-words">
                        {item.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{item.sku}</p>
                      {/* mt-auto pins the stock level to the bottom, so the
                          bars line up across a row of mixed name lengths. */}
                      <div className="mt-auto w-full space-y-1 pt-3">
                        {flags}
                        {stockLevel()}
                      </div>
                    </button>
                    {checkbox("absolute top-1 left-1")}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={swap.baseOpen && !!selectedItem}
        onOpenChange={(open) => {
          if (!open) setDetailsOpen(false);
        }}
      >
        <DialogContent className="max-h-[calc(90dvh/var(--app-zoom,1))] gap-6 overflow-y-auto sm:max-w-2xl">
          {selectedItem && (
            <>
              <DialogHeader className="min-w-0 pr-8 text-left sm:text-left">
                <div className="flex gap-4">
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg sm:size-16">
                    <Package className="text-muted-foreground h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl leading-snug break-words">
                      {selectedItem.name}
                    </DialogTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <DialogDescription className="break-all">
                        SKU: {selectedItem.sku}
                      </DialogDescription>
                      <Badge variant="outline">
                        {selectedItem.type === "material"
                          ? t("management.editStock.material")
                          : t("management.editStock.product")}
                      </Badge>
                      <Badge variant={getStockStatus(selectedItem).variant}>
                        {getStockStatus(selectedItem).label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <Separator />

              <div className="min-w-0 space-y-4">
                <h4 className="font-semibold">{t("management.editStock.stockInfo")}</h4>

                <div className="space-y-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {t("management.editStock.currentStock")}
                    </span>
                    <span
                      className={`text-right font-medium ${selectedItem.currentStock < 0 ? "text-destructive" : ""}`}
                    >
                      {selectedItem.currentStock} / {selectedItem.maxStock} {selectedItem.unit}
                      {" · "}
                      {Math.round(getStockPercentage(selectedItem))}%
                    </span>
                  </div>
                  <Progress
                    value={getStockBarValue(selectedItem)}
                    className={`h-2 ${
                      selectedItem.currentStock <= selectedItem.minStock
                        ? "bg-muted [&>div]:bg-red-600"
                        : "bg-muted [&>div]:bg-emerald-600"
                    }`}
                  />
                  {selectedItem.currentStock < 0 && (
                    <p className="text-destructive text-xs">
                      {tr(
                        "alerts.negativeStock.body",
                        "{name} is showing {count} below zero. Count what's really there and correct it."
                      )
                        .replace("{name}", selectedItem.name)
                        .replace(
                          "{count}",
                          `${Math.abs(selectedItem.currentStock)} ${selectedItem.unit}`
                        )}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("management.editStock.stockValue")}
                    </p>
                    {/* Below zero this is not an asset — it is the cost of
                        stock that was sold but never existed. */}
                    {selectedItem.currentStock * selectedItem.costPerUnit < 0 ? (
                      <>
                        <p className="text-destructive text-2xl font-bold">
                          −
                          {formatPrice(
                            Math.abs(selectedItem.currentStock * selectedItem.costPerUnit)
                          )}
                        </p>
                        <p className="text-destructive text-xs">
                          {tr("data.products.stockStatus.oversold", "Oversold")}
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold">
                        {formatPrice(selectedItem.currentStock * selectedItem.costPerUnit)}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("management.editStock.minStock")}
                    </p>
                    <p className="text-lg font-semibold">
                      {selectedItem.minStock} {selectedItem.unit}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("management.editStock.maxStock")}
                    </p>
                    <p className="text-lg font-semibold">
                      {selectedItem.maxStock} {selectedItem.unit}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      {t("management.editStock.expirationDate")}
                    </p>
                    {/* Editable for raw materials only — the mutation
                        behind it is the material endpoint, and products
                        carry `shelfLife` rather than an expiry date. */}
                    {selectedItem.type !== "material" ? (
                      <p className="text-muted-foreground text-lg font-semibold">&mdash;</p>
                    ) : (
                      <Popover open={expirationPopoverOpen} onOpenChange={setExpirationPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="h-auto p-0 text-lg font-semibold">
                            <CalendarIcon className="mr-1 h-4 w-4" />
                            {selectedItem.expirationDate
                              ? formatDate(selectedItem.expirationDate)
                              : t("management.editStock.expirationDatePlaceholder")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            locale={dateLocale}
                            selected={
                              selectedItem.expirationDate
                                ? new Date(selectedItem.expirationDate)
                                : undefined
                            }
                            onSelect={handleExpirationChange}
                          />
                          {selectedItem.expirationDate && (
                            <div className="border-t p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => handleExpirationChange(undefined)}
                              >
                                {t("management.editStock.clearDate")}
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="min-w-0 space-y-4">
                <h4 className="font-semibold">{t("management.editStock.quickActions")}</h4>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedItem.type === "material") {
                        swap.open("adjust");
                      } else {
                        /* StockAdjustmentDialog posts the selected id as
                           `materialId` unconditionally, so a product must go
                           through the bulk dialog, which routes it as
                           `productId`. Seeded with just this one item. */
                        setSelectedItems([selectedItem.id]);
                        swap.open("bulk");
                      }
                    }}
                  >
                    <Edit3 className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("management.editStock.adjustStock")}
                  </Button>

                  <Button variant="outline" onClick={() => openWaste(selectedItem)}>
                    <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("waste.recordWaste") || "Record Waste"}
                  </Button>

                  <Button variant="outline" onClick={() => swap.open("history")}>
                    <History className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("management.editStock.viewHistory")}
                  </Button>

                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={selectedItem.currentStock <= 0 || resetStock.isPending}
                    onClick={() => swap.open("reset")}
                  >
                    <RotateCcw className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("management.editStock.resetToZero")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Details-dialog layers render as siblings of it, never inside its
          content — that content unmounts while a layer has the screen. */}
      {selectedItem?.type === "material" && (
        <StockAdjustmentDialog
          {...swap.layerProps("adjust")}
          itemId={selectedItem.id}
          itemType="material"
        />
      )}

      <AdjustmentHistoryDialog
        {...swap.layerProps("history")}
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? "material"}
      />

      <CSVImportDialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen} />

      <WasteFormDialog
        {...swap.layerProps("waste")}
        storeId={storeId}
        mode="create"
        itemId={wasteItemId}
        itemType={wasteItemType}
      />

      <BulkAdjustmentDialog
        selectedItems={selectedStockItems}
        open={bulkLayer.open}
        onOpenChange={(open) => {
          bulkLayer.onOpenChange(open);
          if (!open) setSelectedItems([]);
        }}
      />

      <ConfirmationDialog
        {...swap.layerProps("reset")}
        onConfirm={handleResetToZero}
        title={t("management.editStock.resetToZeroConfirmTitle")}
        description={
          selectedItem
            ? t("management.editStock.resetToZeroConfirmDesc")
                .replace("{name}", selectedItem.name)
                .replace("{stock}", `${selectedItem.currentStock} ${selectedItem.unit}`)
            : ""
        }
        confirmText={t("management.editStock.resetToZero")}
        cancelText={t("common.actions.cancel")}
        variant="destructive"
        loading={resetStock.isPending}
      />
    </>
  );
}
