"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { ProductDetailsDialog } from "./product-details-dialog";
import { EditProductDialog } from "./edit-product-dialog";
import { AddProductDialog } from "./add-product-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { SmartImportDialog } from "../../import";
import {
  Search,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  PackageOpen,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Wand2,
  UtensilsCrossed,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils/formatting";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useProducts,
  useProduct,
  useDeleteProduct,
  useBulkDeleteProducts,
  useExportProducts,
  useAddProductToMenu,
  useRemoveProductFromMenu,
  useBulkAddProductsToMenu,
  useBulkRemoveProductsFromMenu,
  useProductMenuStatus,
  useDeleteProductCategory,
  type Product,
} from "../hooks/use-products";
import { useConfirm } from "@/components/ui/use-confirm";
import { useProductUsage } from "../hooks/use-product-usage";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import {
  ItemCardGrid,
  BaseItemCard,
  SectionErrorState,
  SectionLoadingState,
  SKUDisplay,
  ManageCategoriesDialog,
  type CategoryUsage,
} from "../../components";
import type { CategoryDeleteMode } from "@/components/ui/category-delete-dialog";
import { ProductsCardGridSkeleton } from "./products-skeleton";
import { useBulkSelection } from "../../hooks/use-bulk-selection";
import { useDialogState } from "../../hooks/use-dialog-state";

type StockFilter =
  | "all"
  | "in_stock"
  | "low_stock"
  | "critical"
  | "overstocked"
  | "not_counted"
  | "oversold";

/** Every value `getStockStatus` can actually return (i.e. not the "all" pseudo-filter). */
type StockStatus = Exclude<StockFilter, "all">;

/**
 * Mode-aware stock status for a product card.
 *
 * Two rules come before the threshold arithmetic:
 *  1. Only BATCH_PRODUCED products keep a counted finished-goods balance.
 *     MADE_TO_ORDER draws raw materials per sale and UNTRACKED never moves,
 *     so `currentStock` on those rows is meaningless — reporting it as
 *     "critical" (which is what the old `currentStock === 0` test did to
 *     every one of them) is noise, not a signal.
 *  2. A negative balance is an oversell: the store sold stock it did not
 *     have. Stock clamps were removed from the sale path on purpose, so this
 *     is the honest record and must read as the worst state there is. The old
 *     code returned "in_stock" for it whenever minStock was 0 (the schema
 *     default), because `=== 0` missed and both `minStockLevel &&` guards
 *     short-circuited — an oversold product rendered green.
 */
function getStockStatus(product: Product): StockStatus {
  if (product.stockMode !== "BATCH_PRODUCED") return "not_counted";

  const currentStock = Number(product.currentStock) || 0;
  const minStockLevel = Number(product.minStock) || 0;

  if (currentStock < 0) return "oversold";
  if (currentStock === 0) return "critical";
  if (minStockLevel && currentStock < minStockLevel * 0.5) return "critical";
  if (minStockLevel && currentStock <= minStockLevel) return "low_stock";
  return "in_stock";
}

/** Badge colour per status — all from theme variants, never raw hex. */
const STOCK_STATUS_VARIANT: Record<
  StockStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  in_stock: "outline",
  low_stock: "default",
  critical: "destructive",
  overstocked: "secondary",
  // An oversell is a real, money-losing condition — same weight as critical.
  oversold: "destructive",
  // Nothing is wrong with an uncounted product, so it must not shout.
  not_counted: "outline",
};

/** Statuses offered in the filter dropdown, in severity order. */
const STOCK_FILTER_OPTIONS: StockFilter[] = [
  "all",
  "oversold",
  "critical",
  "low_stock",
  "in_stock",
  "not_counted",
];

type ProductSortBy =
  | "name"
  | "sku"
  | "currentStock"
  | "costPrice"
  | "sellingPrice"
  | "createdAt"
  | "updatedAt";
type ProductSortOrder = "asc" | "desc";

interface ProductFiltersState {
  search: string;
  category: string;
  department: "KITCHEN" | "BAR" | undefined;
  // Stock status is derived client-side from stockMode/currentStock, so it
  // filters the loaded page rather than the query — it is deliberately kept
  // out of the object handed to `useProducts`.
  stock: StockFilter;
  sortBy: ProductSortBy;
  sortOrder: ProductSortOrder;
  skip: number;
  take: number;
}

const PRODUCT_FILTER_DEFAULTS: ProductFiltersState = {
  search: "",
  category: "",
  department: undefined,
  stock: "all",
  sortBy: "createdAt",
  sortOrder: "desc",
  skip: 0,
  take: 20,
};

const PRODUCT_SORT_OPTIONS: ProductSortBy[] = [
  "name",
  "sku",
  "currentStock",
  "costPrice",
  "sellingPrice",
  "createdAt",
  "updatedAt",
];

// Search text and pagination position are intentionally never restored from
// storage — only the filter/sort selections carry over across visits.
function sanitizeProductFilters(raw: unknown, defaults: ProductFiltersState): ProductFiltersState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<ProductFiltersState>;
  return {
    search: "",
    category: typeof r.category === "string" ? r.category : defaults.category,
    department: r.department === "KITCHEN" || r.department === "BAR" ? r.department : undefined,
    stock: STOCK_FILTER_OPTIONS.includes(r.stock as StockFilter)
      ? (r.stock as StockFilter)
      : defaults.stock,
    sortBy: PRODUCT_SORT_OPTIONS.includes(r.sortBy as ProductSortBy)
      ? (r.sortBy as ProductSortBy)
      : defaults.sortBy,
    sortOrder: r.sortOrder === "asc" ? "asc" : "desc",
    skip: 0,
    take: typeof r.take === "number" && [10, 20, 50, 100].includes(r.take) ? r.take : defaults.take,
  };
}

interface ProductsSectionProps {
  initialProducts?: Product[];
}

export function ProductsSection({ initialProducts }: ProductsSectionProps = {}) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { advancedReportsAccess } = useFeatureAccess();
  const storeId = params.storeId as string;

  // Filters and pagination state — persisted across visits so switching tabs
  // or navigating away and back keeps the last-used filter/sort selections.
  const [filters, setFilters] = usePersistedState<ProductFiltersState>(
    `epidom-data-products-filters-${storeId}`,
    PRODUCT_FILTER_DEFAULTS,
    sanitizeProductFilters
  );

  // Smart Import dialog state
  const [smartImportOpen, setSmartImportOpen] = useState(false);

  // Debounce search input to reduce API calls (300ms delay)
  const debouncedSearch = useDebounce(filters.search, 300);

  // `stock` is evaluated client-side (it depends on stockMode, which the list
  // endpoint doesn't filter on), so it never reaches the API or the export.
  const { stock: stockFilter, ...queryFilters } = filters;

  // New keys ship in a separate locale change; `t()` echoes the key back when
  // it is missing, so fall back to English rather than render a raw key path.
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  // API hooks
  // Use debouncedSearch instead of filters.search for API calls
  // Use initial data from Server Component with real-time updates
  const { data, isLoading, error, refetch } = useProducts(
    storeId,
    {
      ...queryFilters,
      search: debouncedSearch || undefined,
      // This tab only ever manages the store's regular Kitchen/Bar products —
      // CUSTOM-productLine items (the optional second product line) live in
      // their own Data tab, see custom-products-section.tsx.
      productLine: "STANDARD",
    },
    initialProducts
      ? {
          products: initialProducts,
          total: initialProducts.length,
        }
      : undefined
  );
  const deleteProduct = useDeleteProduct(storeId);
  const bulkDeleteProducts = useBulkDeleteProducts(storeId);
  const exportProducts = useExportProducts();
  const addToMenu = useAddProductToMenu(storeId);
  const removeFromMenu = useRemoveProductFromMenu(storeId);
  const bulkAddToMenu = useBulkAddProductsToMenu(storeId);
  const bulkRemoveFromMenu = useBulkRemoveProductsFromMenu(storeId);
  const { menuLinkedIds } = useProductMenuStatus(storeId);
  const { confirm, confirmDialog } = useConfirm();
  const { data: productUsage, isLoading: isLoadingUsage } = useProductUsage(storeId);
  const deleteProductCategory = useDeleteProductCategory(storeId);

  const products = useMemo(() => data?.products || [], [data]);
  const totalProducts = data?.total || 0;

  // Stock-status filtering happens over the loaded page only — see the note on
  // ProductFiltersState.stock.
  const visibleProducts = useMemo(
    () =>
      stockFilter === "all"
        ? products
        : products.filter((product) => getStockStatus(product) === stockFilter),
    [products, stockFilter]
  );

  // Get unique categories from products, with item counts (for category management)
  const categoryUsage = useMemo<CategoryUsage[]>(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const currentPage = Math.floor(filters.skip / filters.take) + 1;
  const totalPages = Math.ceil(totalProducts / filters.take);

  // Check if user can create more products
  const canCreateMore = productUsage?.canCreateMore ?? true;
  const productLimitReached = !isLoadingUsage && !canCreateMore;
  // Only show badge if limit exists and is not unlimited (null or Infinity means unlimited)
  const showLimitBadge =
    productUsage && productUsage.limit !== null && productUsage.limit !== Infinity;

  // Use reusable hooks for dialog and bulk selection state
  const {
    selectedItem: selectedProduct,
    viewDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    setViewDialogOpen,
    setEditDialogOpen,
    setDeleteDialogOpen,
    setSelectedItem: setSelectedProduct,
    handleView,
    handleEdit,
    handleDeleteClick: handleDeleteClickDialog,
  } = useDialogState<Product>();

  const {
    bulkSelectMode,
    selectedIds,
    selectedCount,
    toggleBulkSelect,
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isSelected,
  } = useBulkSelection(visibleProducts);

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Deep link from the Menu Editor's "Edit in Products" CTA (a product-linked
  // menu item can't be renamed/repriced there — its name/price/department
  // are owned by Product and synced one-way, so it redirects here instead).
  // Falls back to a direct fetch when the product isn't in the currently
  // loaded/filtered page of results.
  const editProductId = searchParams.get("editProduct");
  const { data: editProductFromParam } = useProduct(
    storeId,
    !products.some((p) => p.id === editProductId) ? editProductId : null
  );
  const appliedEditProductParam = useRef(false);
  useEffect(() => {
    if (appliedEditProductParam.current || !editProductId) return;
    const product = products.find((p) => p.id === editProductId) ?? editProductFromParam;
    if (product) {
      appliedEditProductParam.current = true;
      handleEdit(product);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("editProduct");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editProductId, products, editProductFromParam]);

  // Helper function to get stock status label
  const getStockStatusLabel = (status: StockFilter): string => {
    const labels: Record<StockFilter, string> = {
      all: t("filters.allStock"),
      in_stock: t("filters.inStock"),
      low_stock: t("filters.lowStock"),
      critical: t("filters.critical"),
      overstocked: t("filters.overstocked"),
      not_counted: tr("data.products.stockStatus.notCounted", "Not counted"),
      oversold: tr("data.products.stockStatus.oversold", "Oversold"),
    };
    return labels[status];
  };

  // Helper function to calculate profit margin
  const getProfitMargin = (product: Product): number => {
    const selling = Number(product.sellingPrice) || 0;
    const cost = Number(product.costPrice) || 0;
    if (selling === 0) return 0;
    return ((selling - cost) / selling) * 100;
  };

  // Action handlers
  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;

    try {
      await deleteProduct.mutateAsync(selectedProduct.id);
      toast.success(t("data.products.toasts.deleted.title"));
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      await bulkDeleteProducts.mutateAsync(Array.from(selectedIds));
      toast.success(
        t("data.products.toasts.bulkDeleted.description")?.replace(
          "{count}",
          selectedIds.size.toString()
        ) || ""
      );
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete products");
    }
  };

  const handleBulkAddToMenu = async () => {
    const selected = products.filter((p) => selectedIds.has(p.id) && !menuLinkedIds.has(p.id));
    if (selected.length === 0) {
      toast.info(
        t("data.products.toasts.bulkAddToMenuNone") ||
          "Selected products are already in the POS menu"
      );
      return;
    }

    try {
      const result = await bulkAddToMenu.mutateAsync(selected);
      if (result.failed > 0) {
        toast.warning(
          t("data.products.toasts.bulkAddedToMenuPartial")
            ?.replace("{succeeded}", String(result.succeeded))
            .replace("{failed}", String(result.failed)) ||
            `${result.succeeded} added to POS menu, ${result.failed} failed`
        );
      } else {
        toast.success(
          t("data.products.toasts.bulkAddedToMenu")?.replace(
            "{count}",
            String(result.succeeded)
          ) || `${result.succeeded} product(s) added to POS menu`
        );
      }
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add products to menu");
    }
  };

  const handleBulkRemoveFromMenu = async () => {
    const selected = products.filter((p) => selectedIds.has(p.id) && menuLinkedIds.has(p.id));
    if (selected.length === 0) {
      toast.info(
        t("data.products.toasts.bulkRemoveFromMenuNone") ||
          "Selected products are not in the POS menu"
      );
      return;
    }

    const ok = await confirm({
      title: t("data.products.bulkRemoveFromMenuConfirm.title") || "Remove from POS Menu",
      description:
        t("data.products.bulkRemoveFromMenuConfirm.description")?.replace(
          "{count}",
          String(selected.length)
        ) || `Remove ${selected.length} product(s) from the POS menu?`,
      variant: "destructive",
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    });
    if (!ok) return;

    try {
      const result = await bulkRemoveFromMenu.mutateAsync(selected);
      if (result.failed > 0) {
        toast.warning(
          t("data.products.toasts.bulkRemovedFromMenuPartial")
            ?.replace("{succeeded}", String(result.succeeded))
            .replace("{failed}", String(result.failed)) ||
            `${result.succeeded} removed from POS menu, ${result.failed} failed`
        );
      } else {
        toast.success(
          t("data.products.toasts.bulkRemovedFromMenu")?.replace(
            "{count}",
            String(result.succeeded)
          ) || `${result.succeeded} product(s) removed from POS menu`
        );
      }
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove products from menu");
    }
  };

  const handleExport = async () => {
    try {
      await exportProducts.mutateAsync({
        storeId,
        filters: { ...queryFilters, productLine: "STANDARD" },
      });
      toast.success(t("messages.exportSuccessful"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.errorLoadingProducts"));
    }
  };

  const handleDeleteCategory = async (category: string, mode: CategoryDeleteMode) => {
    try {
      await deleteProductCategory.mutateAsync({ category, mode });
      toast.success(t("data.products.manageCategories.deleted"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("data.products.manageCategories.deleteFailed")
      );
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      skip: (newPage - 1) * prev.take,
    }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setFilters((prev) => ({
      ...prev,
      take: newSize,
      skip: 0,
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters(PRODUCT_FILTER_DEFAULTS);
  };

  const hasActiveFilters =
    filters.search || filters.category || filters.department || filters.stock !== "all";

  // Loading state - wait for both products and usage data to sync loading
  // But if we have products (e.g. from initialData), show them immediately
  if ((isLoading || isLoadingUsage) && !products.length) {
    return <ProductsCardGridSkeleton cards={6} />;
  }

  // Show error state
  if (error) {
    return (
      <SectionErrorState
        title={t("common.error")}
        message={error.message || t("messages.errorLoadingProducts")}
        onRetry={() => refetch()}
        retryLabel={t("common.actions.retry")}
      />
    );
  }

  return (
    <>
      <Card className="min-h-[calc((100vh-150px)/var(--app-zoom,1))] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-bold">{t("data.products.pageTitle")}</CardTitle>
              {showLimitBadge && productUsage?.limit !== null && (
                <Badge variant="outline" className="text-xs">
                  {productUsage.current ?? 0} / {productUsage.limit ?? 0}{" "}
                  {t("data.products.limitBadge") || "products"}
                </Badge>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={
                        exportProducts.isPending || !advancedReportsAccess || products.length === 0
                      }
                      className="w-full md:w-auto"
                    >
                      {exportProducts.isPending ? (
                        <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
                      ) : (
                        <Download className="mr-1 hidden h-4 w-4 sm:inline" />
                      )}
                      {t("common.actions.export")}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!advancedReportsAccess && (
                  <TooltipContent>
                    <p>{t("billing.advancedReportsOnly")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSmartImportOpen(true)}
                className="ai-glow w-full md:w-auto"
              >
                <Wand2 className="mr-1 hidden h-4 w-4 sm:inline" />
                {t("import.title")}
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <AddProductDialog storeId={storeId}>
                      <Button size="sm" className="w-full sm:w-auto" disabled={productLimitReached}>
                        <Plus className="mr-1 hidden h-4 w-4 sm:inline" />
                        {t("data.products.addButton")}
                      </Button>
                    </AddProductDialog>
                  </div>
                </TooltipTrigger>
                {productLimitReached && productUsage && productUsage.limit !== null && (
                  <TooltipContent>
                    <p>
                      {t("data.products.limitTooltip")
                        ?.replace("{current}", String(productUsage.current))
                        .replace("{limit}", String(productUsage.limit)) ||
                        `You've reached your plan's product limit (${productUsage.current}/${productUsage.limit}). Upgrade to Pro for unlimited products.`}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManageCategoriesOpen(true)}
                className="w-full md:w-auto"
              >
                <Tags className="mr-1 hidden h-4 w-4 sm:inline" />
                {t("data.products.manageCategories.button")}
              </Button>
              {bulkSelectMode && selectedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkAddToMenu}
                  disabled={bulkAddToMenu.isPending}
                  className="w-full sm:w-auto"
                >
                  {bulkAddToMenu.isPending ? (
                    <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
                  ) : (
                    <UtensilsCrossed className="mr-1 hidden h-4 w-4 sm:inline" />
                  )}
                  {t("data.products.bulkAddToMenu") || "Add to Menu"} ({selectedCount})
                </Button>
              )}
              {bulkSelectMode && selectedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkRemoveFromMenu}
                  disabled={bulkRemoveFromMenu.isPending}
                  className="w-full sm:w-auto"
                >
                  {bulkRemoveFromMenu.isPending ? (
                    <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
                  ) : (
                    <UtensilsCrossed className="mr-1 hidden h-4 w-4 sm:inline" />
                  )}
                  {t("data.products.bulkRemoveFromMenu") || "Remove from Menu"} ({selectedCount})
                </Button>
              )}
              {bulkSelectMode && selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("actions.delete")} ({selectedCount})
                </Button>
              )}
              <Button
                variant={bulkSelectMode ? "default" : "outline"}
                size="sm"
                onClick={toggleBulkSelect}
                className="w-full md:w-auto"
              >
                {bulkSelectMode ? (
                  <>
                    <X className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("actions.cancel")}
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("common.actions.select")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-6">
          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative w-full">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("actions.searchPlaceholder")}
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value, skip: 0 }))
                }
                className="w-full pl-9"
              />
            </div>

            {/* Filters Row */}
            <div className="flex w-full flex-wrap items-center gap-2">
              {/* Sort */}
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(v) => {
                  const [sortBy, sortOrder] = v.split("-") as [
                    typeof filters.sortBy,
                    typeof filters.sortOrder,
                  ];
                  setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
                }}
              >
                <SelectTrigger className="min-h-10 w-full md:w-[180px]">
                  <ArrowUpDown className="mr-1 hidden h-4 w-4 sm:inline" />
                  <SelectValue placeholder={t("filters.placeholderSortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">{t("sort.nameAZ")}</SelectItem>
                  <SelectItem value="name-desc">{t("sort.nameZA")}</SelectItem>
                  <SelectItem value="currentStock-asc">{t("sort.stockLowHigh")}</SelectItem>
                  <SelectItem value="currentStock-desc">{t("sort.stockHighLow")}</SelectItem>
                  <SelectItem value="sellingPrice-asc">{t("sort.priceLowHigh")}</SelectItem>
                  <SelectItem value="sellingPrice-desc">{t("sort.priceHighLow")}</SelectItem>
                  <SelectItem value="createdAt-desc">{t("sort.newest")}</SelectItem>
                  <SelectItem value="createdAt-asc">{t("sort.oldest")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Department filter */}
              <Select
                value={filters.department || "all"}
                onValueChange={(v) =>
                  setFilters((prev) => ({
                    ...prev,
                    department: v === "all" ? undefined : (v as "KITCHEN" | "BAR"),
                    skip: 0,
                  }))
                }
              >
                <SelectTrigger className="min-h-10 w-full md:w-[160px]">
                  <SelectValue placeholder={t("filters.allDepartments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allDepartments")}</SelectItem>
                  <SelectItem value="KITCHEN">{t("common.departmentKitchen")}</SelectItem>
                  <SelectItem value="BAR">{t("common.departmentBar")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Stock status filter */}
              <Select
                value={filters.stock}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, stock: v as StockFilter, skip: 0 }))
                }
              >
                <SelectTrigger className="min-h-10 w-full md:w-[170px]">
                  <SelectValue placeholder={t("filters.allStock")} />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getStockStatusLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full sm:w-auto"
                >
                  <X className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("common.actions.clearFilters")}
                </Button>
              )}
            </div>

            {/* Bulk Select All */}
            {bulkSelectMode && (
              <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
                <Checkbox
                  checked={selectedCount === visibleProducts.length && visibleProducts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("common.selectAll")} ({selectedCount} {t("common.of")}{" "}
                  {visibleProducts.length} {t("common.selected")})
                </span>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="mt-4 flex items-center border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing")} {visibleProducts.length} {t("common.of")} {totalProducts}{" "}
              {t("data.products.pageTitle")}
            </p>
          </div>

          {/* Products Grid */}
          <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }} className="mt-4">
            {visibleProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              const profitMargin = getProfitMargin(product);

              return (
                <BaseItemCard
                  key={product.id}
                  isSelected={isSelected(product.id)}
                  bulkSelectMode={bulkSelectMode}
                  onSelect={() => toggleSelectItem(product.id)}
                  contentClassName="!px-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    {/* min-w-0 so a long product name truncates inside the card
                        instead of pushing the status badge out of it. */}
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-sm leading-tight font-semibold"
                        title={product.name}
                      >
                        {product.name}
                      </h3>
                      {product.sku && <SKUDisplay sku={product.sku} />}
                    </div>

                    {/* Stock Status Badge */}
                    <Badge
                      variant={STOCK_STATUS_VARIANT[stockStatus]}
                      className={`shrink-0 text-xs ${
                        stockStatus === "not_counted"
                          ? "text-muted-foreground border-dashed"
                          : ""
                      }`}
                    >
                      {getStockStatusLabel(stockStatus)}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Product Info */}
                  <div className="text-muted-foreground my-2 space-y-1 text-xs">
                    {product.category && (
                      // Label holds its width, value truncates — otherwise a
                      // long category name pushes the label out of the card.
                      <div className="flex justify-between gap-2">
                        <span className="shrink-0">{t("common.category")}:</span>
                        <span
                          className="text-foreground min-w-0 truncate font-medium"
                          title={product.category}
                        >
                          {product.category}
                        </span>
                      </div>
                    )}
                    {/* The mode itself, in plain language. The stock badge above
                        can say "Not counted" without ever explaining WHY, which
                        leaves the owner no way to tell a cook-to-order dish from
                        a misconfigured one. Change it in Edit → How do you make
                        this? */}
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0">
                        {tr("data.products.howMade.label", "How it's made")}:
                      </span>
                      <span className="text-foreground min-w-0 text-right font-medium">
                        {product.stockMode === "MADE_TO_ORDER"
                          ? tr("data.products.howMade.madeToOrder", "Cooked to order")
                          : product.stockMode === "UNTRACKED"
                            ? tr("data.products.howMade.untracked", "Not tracked")
                            : tr("data.products.howMade.batch", "Counted on a shelf")}
                      </span>
                    </div>
                    {product.department && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0">{t("common.department")}:</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0",
                            product.department === "KITCHEN"
                              ? "text-amber-600"
                              : "text-blue-600"
                          )}
                        >
                          {product.department === "KITCHEN"
                            ? t("common.departmentKitchen")
                            : t("common.departmentBar")}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{t("common.stock")}:</span>
                      {stockStatus === "not_counted" ? (
                        /* No counted balance exists for this mode — showing a
                           number here would be inventing one. */
                        <span className="text-muted-foreground font-medium">&mdash;</span>
                      ) : (
                        <span
                          className={`font-medium ${
                            stockStatus === "oversold" ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {formatNumber(Number(product.currentStock) || 0)} {product.unit}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>{t("common.price")}:</span>
                      <span className="text-foreground font-medium">
                        {formatPrice(Number(product.sellingPrice) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("common.profit")}:</span>
                      <span
                        className={`text-foreground font-medium ${
                          profitMargin >= 50
                            ? "text-green-600"
                            : profitMargin >= 30
                              ? "text-blue-600"
                              : "text-orange-600"
                        }`}
                      >
                        {profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("tables.supplier")}:</span>
                      <span className="text-foreground font-medium">
                        {t("common.notAvailable")}
                      </span>
                    </div>
                  </div>

                  {/* Hover Actions */}
                  {!bulkSelectMode && (
                    <div className="mt-2 grid grid-cols-4 gap-1 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full text-xs"
                            onClick={() => handleView(product)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.products.tooltips.view")}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full flex-1 text-xs"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.products.tooltips.edit")}</p>
                        </TooltipContent>
                      </Tooltip>
                      {menuLinkedIds.has(product.id) ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 w-full flex-1 border border-green-200 bg-green-50 text-xs text-green-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              disabled={removeFromMenu.isPending}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: t("data.products.confirmRemoveFromMenu"),
                                  description: product.name,
                                  variant: "destructive",
                                  confirmText: t("actions.delete"),
                                  cancelText: t("actions.cancel"),
                                });
                                if (!ok) return;
                                try {
                                  await removeFromMenu.mutateAsync(product);
                                  toast.success(
                                    t("data.products.toasts.removedFromMenu") ||
                                      `"${product.name}" removed from POS menu`
                                  );
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to remove from menu"
                                  );
                                }
                              }}
                            >
                              <UtensilsCrossed className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {t("data.products.tooltips.removeFromMenu") ||
                                "In POS menu — click to remove"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 w-full flex-1 text-xs text-foreground/70 hover:text-foreground"
                              disabled={addToMenu.isPending}
                              onClick={async () => {
                                try {
                                  await addToMenu.mutateAsync(product);
                                  toast.success(
                                    t("data.products.toasts.addedToMenu") ||
                                      `"${product.name}" added to POS menu`
                                  );
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Failed to add to menu"
                                  );
                                }
                              }}
                            >
                              <UtensilsCrossed className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.products.tooltips.addToMenu") || "Add to POS menu"}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive bg-destructive/10 hover:bg-destructive/30 h-8 w-full flex-1 text-xs"
                            onClick={() => handleDeleteClickDialog(product)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.products.tooltips.delete")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </BaseItemCard>
              );
            })}
          </ItemCardGrid>

          {/* Empty State */}
          {visibleProducts.length === 0 && (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <PackageOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">{t("messages.noProductsFound")}</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {hasActiveFilters
                  ? t("messages.noMatchingFilters")
                  : t("messages.getStartedProduct")}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  {t("common.actions.clearFilters")}
                </Button>
              ) : (
                <AddProductDialog storeId={storeId} />
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("pagination.rowsPerPage")}:
                </span>
                <Select
                  value={filters.take.toString()}
                  onValueChange={(value) => handlePageSizeChange(Number(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-muted-foreground text-sm">
                  {t("pagination.page")} {currentPage} {t("pagination.of")} {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedProduct && (
        <>
          <ProductDetailsDialog
            storeId={storeId}
            product={selectedProduct}
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            onEdit={() => {
              setViewDialogOpen(false);
              setEditDialogOpen(true);
            }}
            onDelete={() => {
              setViewDialogOpen(false);
              setDeleteDialogOpen(true);
            }}
          />
          <EditProductDialog
            storeId={storeId}
            product={selectedProduct}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <ConfirmationDialog
            title={t("data.products.toasts.deleted.title")}
            description={
              t("data.products.toasts.deleted.description")?.replace(
                "{name}",
                selectedProduct.name
              ) || ""
            }
            confirmText={t("common.actions.delete")}
            onConfirm={handleDeleteConfirm}
            variant="destructive"
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            loading={deleteProduct.isPending}
          />
        </>
      )}

      {/* Bulk Delete Confirmation */}
      <ConfirmationDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={t("data.products.bulkDeleteConfirm.title") || "Delete Multiple Products"}
        description={
          t("data.products.bulkDeleteConfirm.description")?.replace(
            "{count}",
            selectedCount.toString()
          ) ||
          `Are you sure you want to delete ${selectedCount} product(s)? This action cannot be undone.`
        }
        confirmText={t("common.actions.delete")}
        onConfirm={handleBulkDelete}
        variant="destructive"
        loading={bulkDeleteProducts.isPending}
      />
      {/* Smart Import Dialog */}
      <SmartImportDialog
        open={smartImportOpen}
        onOpenChange={setSmartImportOpen}
        storeId={storeId}
      />

      {/* Manage Categories Dialog */}
      <ManageCategoriesDialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        categories={categoryUsage}
        onDelete={handleDeleteCategory}
        isDeleting={deleteProductCategory.isPending}
        title={t("data.products.manageCategories.title")}
        description={t("data.products.manageCategories.description")}
        emptyText={t("data.products.manageCategories.empty")}
        itemCountLabel={(count) =>
          t("data.products.manageCategories.itemCount")?.replace("{count}", String(count)) ||
          `${count}`
        }
        confirmTitle={(category) =>
          t("data.products.manageCategories.confirmTitle")?.replace(
            "{category}",
            category.name
          ) || category.name
        }
        uncategorizeLabel={t("data.products.manageCategories.uncategorizeLabel")}
        uncategorizeDescription={(category) =>
          t("data.products.manageCategories.uncategorizeDescription")?.replace(
            "{count}",
            String(category.count)
          ) || ""
        }
        deleteLabel={t("data.products.manageCategories.deleteLabel")}
        deleteDescription={(category) =>
          t("data.products.manageCategories.deleteDescription")?.replace(
            "{count}",
            String(category.count)
          ) || ""
        }
        confirmText={t("common.actions.delete")}
        cancelText={t("common.actions.cancel")}
      />
      {confirmDialog}
    </>
  );
}
