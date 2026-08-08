"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ExportButton } from "@/components/ui/export-button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMaterials, useUpdateMaterial } from "@/features/dashboard/data/materials/hooks/use-materials";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { FilterBar } from "@/features/dashboard/shared/components/filter-bar";
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
  ShoppingCart,
  ArrowUpDown,
} from "lucide-react";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { BulkAdjustmentDialog } from "./bulk-adjustment-dialog";
import { AdjustmentHistoryDialog } from "./adjustment-history-dialog";
import { CSVImportDialog } from "./csv-import-dialog";
import { WasteFormDialog } from "../waste/waste-form-dialog";
import { ReorderPanel } from "./reorder/reorder-panel";
import type { SupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { useCurrency } from "@/components/providers/currency-provider";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ItemType = "material" | "product";
type StatusFilter = "all" | "low" | "overstock" | "in-stock";
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
  innerTab: "items" | "reorder";
  status: StatusFilter;
  category: string;
  expiration: ExpirationFilter;
  sortField: SortField;
  sortDir: SortDir;
}

const STOCK_FILTER_DEFAULTS: StockFilters = {
  innerTab: "items",
  status: "all",
  category: "all",
  expiration: "any",
  sortField: "name",
  sortDir: "asc",
};

function sanitizeStockFilters(raw: unknown, defaults: StockFilters): StockFilters {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<StockFilters>;
  return {
    innerTab: r.innerTab === "reorder" ? "reorder" : "items",
    status: (["all", "low", "overstock", "in-stock"] as const).includes(r.status as StatusFilter)
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
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface EditStockCardProps {
  initialSupplierOrders?: SupplierOrder[];
  highlightMaterialId?: string | null;
  highlightSupplierId?: string | null;
  onHighlightConsumed?: () => void;
}

export function EditStockCard({
  initialSupplierOrders,
  highlightMaterialId,
  highlightSupplierId,
  onHighlightConsumed,
}: EditStockCardProps = {}) {
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
  const innerTab = highlightMaterialId || highlightSupplierId ? "reorder" : filters.innerTab;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(highlightMaterialId ?? null);
  const [selectedItemType, setSelectedItemType] = useState<ItemType>("material");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkAdjustmentOpen, setBulkAdjustmentOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyItemType, setHistoryItemType] = useState<ItemType>("material");
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [wasteDialogOpen, setWasteDialogOpen] = useState(false);
  const [wasteItemId, setWasteItemId] = useState<string | undefined>(undefined);
  const [wasteItemType, setWasteItemType] = useState<ItemType>("material");
  const [expirationPopoverOpen, setExpirationPopoverOpen] = useState(false);

  const { data: materialsData, isLoading } = useMaterials(storeId);
  const updateMaterial = useUpdateMaterial(storeId, selectedItemId ?? "");

  const allStockItems: StockItem[] = useMemo(() => {
    if (!materialsData?.materials) return [];
    return materialsData.materials.map((m) => ({
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
  }, [materialsData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allStockItems.forEach((item) => item.category && set.add(item.category));
    return Array.from(set).sort();
  }, [allStockItems]);

  const getStockStatus = (item: StockItem) => {
    if (item.currentStock <= item.minStock) {
      return { label: t("management.editStock.lowStock"), variant: "outline" as const, icon: AlertCircle, key: "low" as StatusFilter };
    } else if (item.currentStock > item.maxStock) {
      return { label: "Overstock", variant: "outline" as const, icon: AlertCircle, key: "overstock" as StatusFilter };
    }
    return { label: t("management.editStock.inStock"), variant: "outline" as const, icon: CheckCircle, key: "in-stock" as StatusFilter };
  };

  const getStockPercentage = (item: StockItem) => {
    if (item.maxStock === 0) return 0;
    return (item.currentStock / item.maxStock) * 100;
  };

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

  const viewAdjustmentHistory = (itemId: string, itemType: ItemType) => {
    setHistoryItemId(itemId);
    setHistoryItemType(itemType);
    setHistoryDialogOpen(true);
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

  return (
    <>
      <Tabs
        value={innerTab}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, innerTab: value as "items" | "reorder" }))}
        className="w-full"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("management.editStock.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("management.editStock.description")}</p>
          </div>
          <TabsList>
            <TabsTrigger value="items">
              <Package className="mr-1 h-4 w-4" />
              {t("management.editStock.tabItems")}
            </TabsTrigger>
            <TabsTrigger value="reorder">
              <ShoppingCart className="mr-1 h-4 w-4" />
              {t("management.editStock.tabReorder")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="items" className="mt-4 space-y-6">
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
                    <SelectItem value="all">{t("management.editStock.filterAllCategories")}</SelectItem>
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
                onValueChange={(v) => setFilters((prev) => ({ ...prev, expiration: v as ExpirationFilter }))}
              >
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder={t("management.editStock.filterExpiration")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("management.editStock.filterExpirationAny")}</SelectItem>
                  <SelectItem value="expired">{t("management.editStock.filterExpirationExpired")}</SelectItem>
                  <SelectItem value="soon">{t("management.editStock.filterExpirationSoon")}</SelectItem>
                  <SelectItem value="month">{t("management.editStock.filterExpirationMonth")}</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <Button
                variant="outline"
                size="sm"
                className="w-full md:w-auto"
                onClick={() => {
                  setWasteItemId(undefined);
                  setWasteItemType("material");
                  setWasteDialogOpen(true);
                }}
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr] lg:items-stretch">
            {/* Items List */}
            <Card className="flex min-h-[450px] flex-col p-4 lg:min-h-[400px]">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">
                  {filteredItems.length} {t("management.editStock.items")}
                </span>
                <div className="flex items-center gap-2">
                  {selectedItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkAdjustmentOpen(true)}
                      className="h-auto px-2 py-1 text-xs"
                    >
                      {t("management.editStock.bulkAdjust")} ({selectedItems.length})
                    </Button>
                  )}
                  {filteredItems.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="h-auto p-0 text-xs">
                      {selectedItems.length === filteredItems.length
                        ? t("management.editStock.deselectAll")
                        : t("management.editStock.selectAll")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 pb-2 text-xs">
                <span className="text-muted-foreground">Sort:</span>
                {(["name", "stock", "expiration"] as SortField[]).map((field) => (
                  <Button
                    key={field}
                    variant={filters.sortField === field ? "secondary" : "ghost"}
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
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

              <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto">
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
                  filteredItems.map((item) => {
                    const status = getStockStatus(item);
                    const StatusIcon = status.icon;
                    const isSelected = selectedItems.includes(item.id);
                    const isLow = item.currentStock <= item.minStock;
                    const expirationState = getExpirationState(item);

                    return (
                      <div
                        key={item.id}
                        className={`group hover:border-primary/50 flex w-full items-start gap-2 rounded-lg border p-3 transition-colors ${
                          selectedItemId === item.id ? "border-primary bg-primary/5" : ""
                        } ${isSelected ? "bg-muted/50" : ""}`}
                      >
                        <Checkbox
                          className="mt-1 shrink-0"
                          checked={isSelected}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType(item.type);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{item.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-muted-foreground text-xs">{item.sku}</p>
                                {expirationState && (
                                  <Badge
                                    variant={expirationState === "expired" ? "destructive" : "outline"}
                                    className="text-xs"
                                  >
                                    {expirationState === "expired"
                                      ? t("management.editStock.filterExpirationExpired")
                                      : formatDate(item.expirationDate!)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <StatusIcon className="h-4 w-4 shrink-0" />
                          </div>
                          <div className="mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {item.currentStock} / {item.maxStock} {item.unit}
                              </span>
                              <span className="text-muted-foreground">{Math.round(getStockPercentage(item))}%</span>
                            </div>
                            <Progress
                              value={Math.min(getStockPercentage(item), 100)}
                              className={`mt-1 h-1.5 ${isLow ? "bg-muted [&>div]:bg-red-600" : "bg-muted [&>div]:bg-emerald-600"}`}
                            />
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Item Details & Editor */}
            <Card className="flex min-h-[450px] flex-col p-6 lg:min-h-[400px]">
              {selectedItem ? (
                <div className="flex flex-1 flex-col space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-lg">
                        <Package className="text-muted-foreground h-8 w-8" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedItem.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-muted-foreground text-sm">SKU: {selectedItem.sku}</p>
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
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-semibold">{t("management.editStock.stockInfo")}</h4>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("management.editStock.currentStock")}</span>
                        <span className="font-medium">
                          {selectedItem.currentStock} / {selectedItem.maxStock} {selectedItem.unit}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(getStockPercentage(selectedItem), 100)}
                        className={`h-2 ${
                          selectedItem.currentStock <= selectedItem.minStock
                            ? "bg-muted [&>div]:bg-red-600"
                            : "bg-muted [&>div]:bg-emerald-600"
                        }`}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-muted-foreground text-sm">{t("management.editStock.stockValue")}</p>
                        <p className="text-2xl font-bold">
                          {formatPrice(selectedItem.currentStock * selectedItem.costPerUnit)}
                        </p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <p className="text-muted-foreground text-sm">{t("management.editStock.minStock")}</p>
                        <p className="text-lg font-semibold">
                          {selectedItem.minStock} {selectedItem.unit}
                        </p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <p className="text-muted-foreground text-sm">{t("management.editStock.maxStock")}</p>
                        <p className="text-lg font-semibold">
                          {selectedItem.maxStock} {selectedItem.unit}
                        </p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <p className="text-muted-foreground text-sm">{t("management.editStock.expirationDate")}</p>
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
                                selectedItem.expirationDate ? new Date(selectedItem.expirationDate) : undefined
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
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-semibold">{t("management.editStock.quickActions")}</h4>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <StockAdjustmentDialog
                        itemId={selectedItem.id}
                        itemType={selectedItem.type}
                        trigger={
                          <Button variant="outline" className="w-full">
                            <Edit3 className="mr-1 hidden h-4 w-4 sm:inline" />
                            {t("management.editStock.adjustStock")}
                          </Button>
                        }
                      />

                      <Button
                        variant="outline"
                        onClick={() => {
                          setWasteItemId(selectedItem.id);
                          setWasteItemType(selectedItem.type);
                          setWasteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
                        {t("waste.recordWaste") || "Record Waste"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => viewAdjustmentHistory(selectedItem.id, selectedItem.type)}
                      >
                        <History className="mr-1 hidden h-4 w-4 sm:inline" />
                        {t("management.editStock.viewHistory")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <Package className="text-muted-foreground mx-auto h-16 w-16" />
                    <h3 className="mt-4 text-lg font-semibold">{t("management.editStock.selectItem")}</h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {t("management.editStock.selectItemDescription")}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reorder" className="mt-4">
          <ReorderPanel
            storeId={storeId}
            initialSupplierOrders={initialSupplierOrders}
            highlightMaterialId={highlightMaterialId}
            highlightSupplierId={highlightSupplierId}
            onHighlightConsumed={onHighlightConsumed}
          />
        </TabsContent>
      </Tabs>

      <AdjustmentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        itemId={historyItemId}
        itemType={historyItemType}
      />

      <CSVImportDialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen} />

      <WasteFormDialog
        open={wasteDialogOpen}
        onOpenChange={setWasteDialogOpen}
        storeId={storeId}
        mode="create"
        itemId={wasteItemId}
        itemType={wasteItemType}
      />

      <BulkAdjustmentDialog
        selectedItems={selectedStockItems}
        open={bulkAdjustmentOpen}
        onOpenChange={(open) => {
          setBulkAdjustmentOpen(open);
          if (!open) setSelectedItems([]);
        }}
      />
    </>
  );
}
