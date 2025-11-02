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
import MaterialDetailsDialog from "./material-details-dialog";
import EditMaterialDialog from "./edit-material-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ExportButton } from "@/components/ui/export-button";
import AddMaterialDialog from "./add-material-dialog";
import type { Material } from "@/types/entities";
import { MaterialCategory } from "@/types/entities";
import { MOCK_SUPPLIERS } from "@/mocks";
import {
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface MaterialsSectionProps {
  materials: Material[];
}

type SortField = "name" | "stock" | "cost" | "category";
type SortOrder = "asc" | "desc";
type StockFilter = "all" | "in_stock" | "low_stock" | "critical" | "overstocked";

export function MaterialsSection({ materials }: MaterialsSectionProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Helper function to determine stock status
  const getStockStatus = (material: Material): StockFilter => {
    const { currentStock, minStock, maxStock } = material;
    if (currentStock === 0) return "critical";
    if (currentStock < minStock * 0.5) return "critical";
    if (currentStock <= minStock) return "low_stock";
    if (currentStock >= maxStock) return "overstocked";
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

  // Filtered and sorted materials
  const processedMaterials = useMemo(() => {
    let filtered = materials;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.sku?.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((m) => m.category === categoryFilter);
    }

    // Supplier filter
    if (supplierFilter !== "all") {
      filtered = filtered.filter((m) => m.supplierId === supplierFilter);
    }

    // Stock filter
    if (stockFilter !== "all") {
      filtered = filtered.filter((m) => getStockStatus(m) === stockFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "stock":
          comparison = a.currentStock - b.currentStock;
          break;
        case "cost":
          comparison = a.costPerUnit - b.costPerUnit;
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [materials, searchQuery, categoryFilter, supplierFilter, stockFilter, sortField, sortOrder]);

  // Bulk selection handlers
  const toggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedMaterials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedMaterials.map((m) => m.id)));
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
  const handleView = (material: Material) => {
    setSelectedMaterial(material);
    setViewDialogOpen(true);
  };

  const handleEdit = (material: Material) => {
    setSelectedMaterial(material);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (material: Material) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    // TODO: API call to delete material
    const deletedDesc = t("data.materials.toasts.deleted.description") || "{name} has been deleted successfully.";
    toast({
      title: t("data.materials.toasts.deleted.title"),
      description: deletedDesc.replace(
        "{name}",
        selectedMaterial?.name || ""
      ),
    });
    setDeleteDialogOpen(false);
    setSelectedMaterial(null);
  };

  const handleBulkDelete = () => {
    // TODO: API call to bulk delete materials
    const bulkDeletedDesc = t("data.materials.toasts.bulkDeleted.description") || "{count} materials have been deleted successfully.";
    toast({
      title: t("data.materials.toasts.bulkDeleted.title"),
      description: bulkDeletedDesc.replace(
        "{count}",
        selectedIds.size.toString()
      ),
    });
    setSelectedIds(new Set());
  };

  // Export columns configuration
  const exportColumns = [
    { key: "name" as const, header: "Name" },
    { key: "sku" as const, header: "SKU" },
    { key: "category" as const, header: "Category" },
    { key: "currentStock" as const, header: "Current Stock" },
    { key: "unit" as const, header: "Unit" },
    { key: "costPerUnit" as const, header: "Cost Per Unit" },
    { key: "minStock" as const, header: "Min Stock" },
    { key: "maxStock" as const, header: "Max Stock" },
  ];

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSupplierFilter("all");
    setStockFilter("all");
    setSortField("name");
    setSortOrder("asc");
  };

  const hasActiveFilters =
    searchQuery || categoryFilter !== "all" || supplierFilter !== "all" || stockFilter !== "all";

  return (
    <>
      <Card className="overflow-hidden shadow-md">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">
              {t("data.materials.pageTitle") || "Materials"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <ExportButton
                data={processedMaterials}
                filename="materials"
                columns={exportColumns}
                title="Materials"
              />
              <AddMaterialDialog />
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

        <CardContent className="space-y-4">
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
            <div className="flex items-center gap-2">
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("common.actions.filter") || "All Categories"}
                  </SelectItem>
                  {Object.values(MaterialCategory).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Supplier Filter */}
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderSupplier")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("filters.allSuppliers") || "All Suppliers"}
                  </SelectItem>
                  {MOCK_SUPPLIERS.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
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
                  <SelectItem value="cost-asc">
                    {t("sort.costLowHigh") || "Cost (Low-High)"}
                  </SelectItem>
                  <SelectItem value="cost-desc">
                    {t("sort.costHighLow") || "Cost (High-Low)"}
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
                    selectedIds.size === processedMaterials.length && processedMaterials.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("common.selectAll") || "Select All"} ({selectedIds.size}{" "}
                  {t("common.of") || "of"} {processedMaterials.length}{" "}
                  {t("common.selected") || "selected"})
                </span>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing") || "Showing"} {processedMaterials.length}{" "}
              {t("common.of") || "of"} {materials.length}{" "}
              {t("data.materials.pageTitle") || "materials"}
            </p>
          </div>

          {/* Materials Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {processedMaterials.map((material) => {
              const stockStatus = getStockStatus(material);
              const isSelected = selectedIds.has(material.id);

              return (
                <div
                  key={material.id}
                  className={`group bg-card relative rounded-lg border p-4 px-6 shadow-sm transition-all hover:shadow-md ${
                    isSelected ? "ring-primary ring-2" : ""
                  }`}
                >
                  {/* Bulk Select Checkbox */}
                  {bulkSelectMode && (
                    <div className="absolute top-2 left-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectItem(material.id)}
                      />
                    </div>
                  )}

                  {/* Material Content */}
                  <div className={bulkSelectMode ? "pl-6" : ""}>
                    <div className="flex items-end justify-between">
                      <div className="flex-1">
                        <h3 className="w-[80px] truncate text-sm leading-tight font-semibold">
                          {material.name}
                        </h3>
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
                        className="ml-2 text-xs"
                      >
                        {getStockStatusLabel(stockStatus)}
                      </Badge>
                    </div>
                    <div>
                      {material.sku && (
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {t("common.sku")}: {material.sku}
                        </p>
                      )}
                    </div>

                    <Separator className="my-2" />

                    {/* Material Info */}
                    <div className="text-muted-foreground space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>{t("common.stock")}:</span>
                        <span className="text-foreground font-medium">
                          {material.currentStock} {material.unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("common.cost")}:</span>
                        <span className="text-foreground font-medium">
                          ${material.costPerUnit}/{material.unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("common.category")}:</span>
                        <span className="text-foreground font-medium">
                          {material.category.replace("_", " ")}
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
                              onClick={() => handleView(material)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.materials.tooltips.view")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 w-full flex-1 text-xs"
                              onClick={() => handleEdit(material)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.materials.tooltips.edit")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive bg-destructive/10 hover:bg-destructive/30 h-8 w-full flex-1 text-xs"
                              onClick={() => handleDeleteClick(material)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.materials.tooltips.delete")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {processedMaterials.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? t("messages.noMatchingFilters") || "No materials match your filters"
                    : t("messages.noMaterialsFound") || "No materials found"}
                </p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    {t("common.actions.clearAllFilters") || "Clear all filters"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedMaterial && (
        <>
          <MaterialDetailsDialog
            material={selectedMaterial}
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
          />
          <EditMaterialDialog
            material={selectedMaterial}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
        </>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("data.materials.toasts.deleted.title") || "Delete Material"}
        description={(t("data.materials.toasts.deleted.description") || "{name} has been deleted successfully.").replace("{name}", selectedMaterial?.name || "")}
        confirmText={t("common.actions.delete") || "Delete"}
        variant="destructive"
      />
    </>
  );
}
