"use client";

import { useState, useMemo } from "react";
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
import ProductDetailsDialog from "./product-details-dialog";
import EditProductDialog from "./edit-product-dialog";
import AddProductDialog from "./add-product-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ExportButton } from "@/components/ui/export-button";
import type { Product } from "@/types/entities";
import { MOCK_RECIPES } from "@/mocks";
import {
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  PackageOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/lib/utils/formatting";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ProductsSectionProps {
  products: Product[];
}

type SortField = "name" | "stock" | "price" | "category" | "profit";
type SortOrder = "asc" | "desc";
type StockFilter = "all" | "in_stock" | "low_stock" | "critical" | "overstocked";

export function ProductsSection({ products }: ProductsSectionProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Helper function to determine stock status
  const getStockStatus = (product: Product): StockFilter => {
    if (!product.currentStock && product.currentStock !== 0) return "in_stock";
    const { currentStock, minStock, maxStock } = product;
    if (currentStock === 0) return "critical";
    if (minStock && currentStock < minStock * 0.5) return "critical";
    if (minStock && currentStock <= minStock) return "low_stock";
    if (maxStock && currentStock >= maxStock) return "overstocked";
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
    if (!product.retailPrice || !product.costPrice) return 0;
    return ((product.retailPrice - product.costPrice) / product.retailPrice) * 100;
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  // Filtered and sorted products
  const processedProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Stock filter
    if (stockFilter !== "all") {
      filtered = filtered.filter((p) => getStockStatus(p) === stockFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "stock":
          comparison = (a.currentStock || 0) - (b.currentStock || 0);
          break;
        case "price":
          comparison = (a.retailPrice || 0) - (b.retailPrice || 0);
          break;
        case "category":
          comparison = (a.category || "").localeCompare(b.category || "");
          break;
        case "profit":
          comparison = getProfitMargin(a) - getProfitMargin(b);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [products, searchQuery, categoryFilter, stockFilter, sortField, sortOrder]);

  // Bulk selection handlers
  const toggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedProducts.map((p) => p.id)));
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

  const handleDeleteConfirm = () => {
    // TODO: API call to delete product
    const deletedDesc = t("data.products.toasts.deleted.description") || "{name} has been deleted successfully.";
    toast({
      title: t("data.products.toasts.deleted.title"),
      description: deletedDesc.replace(
        "{name}",
        selectedProduct?.name || ""
      ),
    });
    setDeleteDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleBulkDelete = () => {
    // TODO: API call to bulk delete products
    const bulkDeletedDesc = t("data.products.toasts.bulkDeleted.description") || "{count} products have been deleted successfully.";
    toast({
      title: t("data.products.toasts.bulkDeleted.title"),
      description: bulkDeletedDesc.replace(
        "{count}",
        selectedIds.size.toString()
      ),
    });
    setSelectedIds(new Set());
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStockFilter("all");
    setSortField("name");
    setSortOrder("asc");
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || stockFilter !== "all";

  // Export columns configuration
  const exportColumns = [
    { key: "name" as const, header: "Name" },
    { key: "sku" as const, header: "SKU" },
    { key: "category" as const, header: "Category" },
    { key: "retailPrice" as const, header: "Retail Price" },
    { key: "wholesalePrice" as const, header: "Wholesale Price" },
    { key: "costPrice" as const, header: "Cost Price" },
    { key: "currentStock" as const, header: "Current Stock" },
    { key: "unit" as const, header: "Unit" },
  ];

  return (
    <>
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">{t("data.products.pageTitle") || "Products"}</CardTitle>
            <div className="flex items-center gap-2">
              <ExportButton
                data={processedProducts}
                filename="products"
                columns={exportColumns}
                title="Products"
              />
              <AddProductDialog />
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("filters.allCategories") || "All Categories"}
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category ?? "none"}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Stock Status Filter */}
              <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderStockStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allStock") || "All Stock"}</SelectItem>
                  <SelectItem value="in_stock">{t("filters.inStock") || "In Stock"}</SelectItem>
                  <SelectItem value="low_stock">{t("filters.lowStock") || "Low Stock"}</SelectItem>
                  <SelectItem value="critical">{t("filters.critical") || "Critical"}</SelectItem>
                  <SelectItem value="overstocked">
                    {t("filters.overstocked") || "Overstocked"}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={(v) => {
                  const [field, order] = v.split("-") as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderSortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">{t("sort.nameAZ") || "Name (A-Z)"}</SelectItem>
                  <SelectItem value="name-desc">{t("sort.nameZA") || "Name (Z-A)"}</SelectItem>
                  <SelectItem value="stock-asc">
                    {t("sort.stockLowHigh") || "Stock (Low-High)"}
                  </SelectItem>
                  <SelectItem value="stock-desc">
                    {t("sort.stockHighLow") || "Stock (High-Low)"}
                  </SelectItem>
                  <SelectItem value="price-asc">
                    {t("sort.priceLowHigh") || "Price (Low-High)"}
                  </SelectItem>
                  <SelectItem value="price-desc">
                    {t("sort.priceHighLow") || "Price (High-Low)"}
                  </SelectItem>
                  <SelectItem value="profit-asc">
                    {t("sort.profitLowHigh") || "Profit (Low-High)"}
                  </SelectItem>
                  <SelectItem value="profit-desc">
                    {t("sort.profitHighLow") || "Profit (High-Low)"}
                  </SelectItem>
                  <SelectItem value="category-asc">
                    {t("sort.categoryAZ") || "Category (A-Z)"}
                  </SelectItem>
                  <SelectItem value="category-desc">
                    {t("sort.categoryZA") || "Category (Z-A)"}
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
                  checked={
                    selectedIds.size === processedProducts.length && processedProducts.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("common.selectAll") || "Select All"} ({selectedIds.size}{" "}
                  {t("common.of") || "of"} {processedProducts.length}{" "}
                  {t("common.selected") || "selected"})
                </span>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing") || "Showing"} {processedProducts.length} {t("common.of") || "of"}{" "}
              {products.length} {t("data.products.pageTitle") || "products"}
            </p>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {processedProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              const profitMargin = getProfitMargin(product);
              const isSelected = selectedIds.has(product.id);
              const recipe = MOCK_RECIPES.find((r) => r.id === product.recipeId);

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
                      <div className="flex-1">
                        <h3 className="w-[85px] truncate text-sm leading-tight font-semibold">
                          {product.name}
                        </h3>
                        {product.sku && (
                          <p className="text-muted-foreground text-xs">{t("common.sku")}: {product.sku}</p>
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
                      {recipe && (
                        <div className="flex justify-between">
                          <span>{t("common.recipe")}:</span>
                          <span className="text-foreground font-medium">{recipe.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>{t("common.stock")}:</span>
                        <span className="text-foreground font-medium">
                          {formatNumber(product.currentStock || 0)} {product.unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("common.price")}:</span>
                        <span className="text-foreground font-medium">
                          {formatCurrency(product.retailPrice || 0)}
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
                      <div className="mt-2 grid grid-cols-3 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
            {processedProducts.length === 0 && (
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
                  <AddProductDialog />
                )}
              </div>
            )}
          </div>
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
            product={selectedProduct}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <ConfirmationDialog
            title={t("data.products.toasts.deleted.title") || "Delete Product"}
            description={(t("data.products.toasts.deleted.description") || "{name} has been deleted successfully.").replace("{name}", selectedProduct.name)}
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
