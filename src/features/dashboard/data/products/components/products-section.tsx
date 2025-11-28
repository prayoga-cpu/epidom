"use client";

import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils/formatting";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useProducts,
  useDeleteProduct,
  useBulkDeleteProducts,
  useExportProducts,
  type Product,
} from "../hooks/use-products";
import { useProductUsage } from "../hooks/use-product-usage";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import {
  ItemCardGrid,
  BaseItemCard,
  SectionErrorState,
  SectionLoadingState,
} from "../../components";
import { ProductsCardGridSkeleton } from "./products-skeleton";
import { useBulkSelection } from "../../hooks/use-bulk-selection";
import { useDialogState } from "../../hooks/use-dialog-state";

type StockFilter = "all" | "in_stock" | "low_stock" | "critical" | "overstocked";

interface ProductsSectionProps {
  initialProducts?: Product[];
}

export function ProductsSection({ initialProducts }: ProductsSectionProps = {}) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const { advancedReportsAccess } = useFeatureAccess();
  const storeId = params.storeId as string;

  // Filters and pagination state
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
    skip: 0,
    take: 20,
  });

  // Debounce search input to reduce API calls (300ms delay)
  const debouncedSearch = useDebounce(filters.search, 300);

  // API hooks
  // Use debouncedSearch instead of filters.search for API calls
  // Use initial data from Server Component with real-time updates
  const { data, isLoading, error, refetch } = useProducts(
    storeId,
    {
      ...filters,
      search: debouncedSearch || undefined,
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
  const { data: productUsage, isLoading: isLoadingUsage } = useProductUsage(storeId);

  const products = data?.products || [];
  const totalProducts = data?.total || 0;
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
  } = useBulkSelection(products);

  // Helper function to determine stock status
  const getStockStatus = (product: Product): StockFilter => {
    const currentStock = Number(product.currentStock) || 0;
    const minStockLevel = Number(product.minStock) || 0;
    if (currentStock === 0) return "critical";
    if (minStockLevel && currentStock < minStockLevel * 0.5) return "critical";
    if (minStockLevel && currentStock <= minStockLevel) return "low_stock";
    return "in_stock";
  };

  // Helper function to get stock status label
  const getStockStatusLabel = (status: StockFilter): string => {
    const labels: Record<StockFilter, string> = {
      all: t("filters.allStock"),
      in_stock: t("filters.inStock"),
      low_stock: t("filters.lowStock"),
      critical: t("filters.critical"),
      overstocked: t("filters.overstocked"),
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

  const handleExport = async () => {
    try {
      await exportProducts.mutateAsync({ storeId, filters });
      toast.success(t("messages.exportSuccessful"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.errorLoadingProducts"));
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
    setFilters({
      search: "",
      category: "",
      sortBy: "createdAt",
      sortOrder: "desc",
      skip: 0,
      take: 20,
    });
  };

  const hasActiveFilters = filters.search || filters.category;

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
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
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
              {bulkSelectMode && selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
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
                    {t("common.actions.view")}
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
                <SelectTrigger className="w-full md:w-[180px]">
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
                  checked={selectedCount === products.length && products.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("common.selectAll")} ({selectedCount} {t("common.of")} {products.length}{" "}
                  {t("common.selected")})
                </span>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing")} {products.length} {t("common.of")} {totalProducts}{" "}
              {t("data.products.pageTitle")}
            </p>
          </div>

          {/* Products Grid */}
          <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
            {products.map((product) => {
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
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm leading-tight font-semibold">{product.name}</h3>
                      {product.sku && (
                        <p className="text-muted-foreground text-xs">SKU: {product.sku}</p>
                      )}
                    </div>

                    {/* Stock Status Badge */}
                    <Badge
                      variant={
                        stockStatus === "critical"
                          ? "destructive"
                          : stockStatus === "low_stock"
                            ? "default"
                            : stockStatus === "overstocked"
                              ? "secondary"
                              : "outline"
                      }
                      className="ml-auto text-xs"
                    >
                      {getStockStatusLabel(stockStatus)}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Product Info */}
                  <div className="text-muted-foreground my-2 space-y-1 text-xs">
                    {product.category && (
                      <div className="flex justify-between">
                        <span>{t("common.category")}:</span>
                        <span className="text-foreground font-medium">{product.category}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{t("common.stock")}:</span>
                      <span className="text-foreground font-medium">
                        {formatNumber(Number(product.currentStock) || 0)} {product.unit}
                      </span>
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
                    <div className="mt-2 grid grid-cols-3 gap-1 transition-opacity">
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
          {products.length === 0 && (
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
    </>
  );
}
