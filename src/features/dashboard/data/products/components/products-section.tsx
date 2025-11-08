"use client";

import { useState } from "react";
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
import ProductDetailsDialog from "./product-details-dialog";
import EditProductDialog from "./edit-product-dialog";
import AddProductDialog from "./add-product-dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/utils/formatting";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useProducts,
  useDeleteProduct,
  useBulkDeleteProducts,
  useExportProducts,
  type Product,
} from "../hooks/use-products";

type StockFilter = "all" | "in_stock" | "low_stock" | "critical" | "overstocked";

export function ProductsSection() {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
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

  // UI state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // API hooks
  const { data, isLoading, error } = useProducts(storeId, filters);
  const deleteProduct = useDeleteProduct(storeId);
  const bulkDeleteProducts = useBulkDeleteProducts(storeId);
  const exportProducts = useExportProducts();

  const products = data?.products || [];
  const totalProducts = data?.total || 0;
  const currentPage = Math.floor(filters.skip / filters.take) + 1;
  const totalPages = Math.ceil(totalProducts / filters.take);

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
      all: t("filters.allStock") || "All Stock",
      in_stock: t("filters.inStock") || "In Stock",
      low_stock: t("filters.lowStock") || "Low Stock",
      critical: t("filters.critical") || "Critical",
      overstocked: t("filters.overstocked") || "Overstocked",
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

  // Bulk selection handlers
  const toggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Action handlers
  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setViewDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;

    try {
      await deleteProduct.mutateAsync(selectedProduct.id);
      toast.success(t("data.products.toasts.deleted.title") || "Product deleted successfully");
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
        `${selectedIds.size} ${t("data.products.pageTitle") || "products"} deleted successfully`
      );
      setSelectedIds(new Set());
      setBulkSelectMode(false);
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardContent className="flex min-h-[400px] flex-col items-center justify-center gap-2">
          <p className="text-destructive">Error loading products</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">{t("data.products.pageTitle") || "Products"}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exportProducts.isPending}
              >
                {exportProducts.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {t("common.actions.export")}
              </Button>
              <AddProductDialog storeId={storeId} />
              {bulkSelectMode && selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("actions.delete") || "Delete"} ({selectedIds.size})
                </Button>
              )}
              <Button
                variant={bulkSelectMode ? "default" : "outline"}
                size="sm"
                onClick={toggleBulkSelect}
              >
                {bulkSelectMode ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    {t("actions.cancel") || "Cancel"}
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {t("common.actions.view") || "Select"}
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
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("actions.searchPlaceholder") || "Search..."}
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value, skip: 0 }))
                }
                className="pl-9"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
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
                <SelectTrigger>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderSortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">{t("sort.nameAZ") || "Name (A-Z)"}</SelectItem>
                  <SelectItem value="name-desc">{t("sort.nameZA") || "Name (Z-A)"}</SelectItem>
                  <SelectItem value="currentStock-asc">
                    {t("sort.stockLowHigh") || "Stock (Low-High)"}
                  </SelectItem>
                  <SelectItem value="currentStock-desc">
                    {t("sort.stockHighLow") || "Stock (High-Low)"}
                  </SelectItem>
                  <SelectItem value="sellingPrice-asc">
                    {t("sort.priceLowHigh") || "Price (Low-High)"}
                  </SelectItem>
                  <SelectItem value="sellingPrice-desc">
                    {t("sort.priceHighLow") || "Price (High-Low)"}
                  </SelectItem>
                  <SelectItem value="createdAt-desc">
                    {t("sort.newest")}
                  </SelectItem>
                  <SelectItem value="createdAt-asc">
                    {t("sort.oldest")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  {t("common.actions.clearFilters") || "Clear Filters"}
                </Button>
              )}
            </div>

            {/* Bulk Select All */}
            {bulkSelectMode && (
              <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
                <Checkbox
                  checked={selectedIds.size === products.length && products.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("common.selectAll") || "Select All"} ({selectedIds.size}{" "}
                  {t("common.of") || "of"} {products.length} {t("common.selected") || "selected"})
                </span>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing") || "Showing"} {products.length} {t("common.of") || "of"}{" "}
              {totalProducts} {t("data.products.pageTitle") || "products"}
            </p>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const stockStatus = getStockStatus(product);
              const profitMargin = getProfitMargin(product);
              const isSelected = selectedIds.has(product.id);

              return (
                <Card
                  key={product.id}
                  className={`group bg-card relative rounded-lg border px-0 py-4 shadow-sm transition-all hover:shadow-md ${
                    isSelected ? "ring-primary ring-2" : ""
                  }`}
                >
                  {/* Bulk Select Checkbox */}
                  {bulkSelectMode && (
                    <div className="absolute top-4 left-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectItem(product.id)}
                      />
                    </div>
                  )}

                  {/* Product Content */}
                  <CardContent className={`${bulkSelectMode ? "pl-6" : ""}`}>
                    <div className="mb-2 flex items-start justify-between">
                      <div className="w-1 flex-1">
                        <h3 className="w-[85px] truncate text-sm leading-tight font-semibold">
                          {product.name}
                        </h3>
                        {product.sku && (
                          <p className="text-muted-foreground truncate text-xs">
                            {t("common.sku")}: {product.sku}
                          </p>
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
                          className={`font-medium ${
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
                              onClick={() => handleDeleteClick(product)}
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
                  </CardContent>
                </Card>
              );
            })}
            {/* Empty State */}
            {products.length === 0 && (
              <div className="col-span-full flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <PackageOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">
                  {t("messages.noProductsFound") || "No products found"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {hasActiveFilters
                    ? t("messages.noMatchingFilters") ||
                      "Try adjusting your filters or search query"
                    : t("messages.getStartedProduct") || "Get started by adding your first product"}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    {t("common.actions.clearFilters") || "Clear Filters"}
                  </Button>
                ) : (
                  <AddProductDialog storeId={storeId} />
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("pagination.rowsPerPage") || "Rows per page"}:
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
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("pagination.page") || "Page"} {currentPage} {t("pagination.of") || "of"}{" "}
                  {totalPages}
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
            title={t("data.products.toasts.deleted.title") || "Delete Product"}
            description={(
              t("data.products.toasts.deleted.description") ||
              "{name} has been deleted successfully."
            ).replace("{name}", selectedProduct.name)}
            confirmText={t("common.actions.delete") || "Delete"}
            onConfirm={handleDeleteConfirm}
            variant="destructive"
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          />
        </>
      )}
    </>
  );
}
