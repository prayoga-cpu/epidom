"use client";

import { useState, useMemo } from "react";
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
import MaterialDetailsDialog from "./material-details-dialog";
import EditMaterialDialog from "./edit-material-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import AddMaterialDialog from "./add-material-dialog";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import {
  Search,
  Filter,
  Eye,
  Pencil,
  Trash2,
  X,
  Loader2,
  Download,
  AlertCircle,
  CheckSquare,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  useMaterials,
  useDeleteMaterial,
  useBulkDeleteMaterials,
  useExportMaterials,
} from "../hooks/use-materials";

type StockFilter = "in_stock" | "low_stock" | "out_of_stock" | "overstocked" | undefined;

// Helper function to get stock status
function getStockStatus(current: number, min: number, max: number): string {
  if (current <= 0) return "Out of Stock";
  if (current <= min) return "Low Stock";
  if (current > max) return "Overstocked";
  return "In Stock";
}

// Helper function to get stock status variant
function getStockStatusVariant(
  status: string
): "default" | "destructive" | "secondary" | "outline" {
  if (status === "Out of Stock") return "destructive";
  if (status === "Low Stock") return "outline";
  if (status === "Overstocked") return "secondary";
  return "default";
}

export function MaterialsSection() {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;

  // Filters state
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    supplierId: "",
    stockStatus: undefined as StockFilter,
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
    skip: 0,
    take: 50,
  });

  // UI state
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithSuppliers | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Data fetching
  const { data, isLoading, error, refetch } = useMaterials(storeId, filters);
  const materials = data?.materials || [];
  const total = data?.total || 0;

  const deleteMaterial = useDeleteMaterial(storeId);
  const bulkDelete = useBulkDeleteMaterials(storeId);
  const exportMaterials = useExportMaterials(storeId);

  // Get unique categories from materials
  const categories = useMemo(() => {
    const cats = new Set(materials.map((m) => m.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [materials]);

  // Filter and process materials
  const processedMaterials = useMemo(() => {
    let filtered = [...materials];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.sku?.toLowerCase().includes(query) ||
          m.category?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter((m) => m.category === filters.category);
    }

    // Stock status filter
    if (filters.stockStatus) {
      filtered = filtered.filter((m) => {
        const status = getStockStatus(
          Number(m.currentStock),
          Number(m.minStock),
          Number(m.maxStock)
        );
        const statusMap: Record<string, StockFilter> = {
          "Out of Stock": "out_of_stock",
          "Low Stock": "low_stock",
          Overstocked: "overstocked",
          "In Stock": "in_stock",
        };
        return statusMap[status] === filters.stockStatus;
      });
    }

    return filtered;
  }, [materials, filters.search, filters.category, filters.stockStatus]);

  // Filter handlers
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, skip: 0 }));
  };

  const handleCategoryFilter = (value: string) => {
    setFilters((prev) => ({ ...prev, category: value === "all" ? "" : value, skip: 0 }));
  };

  const handleStockStatusFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      stockStatus: value === "all" ? undefined : (value as StockFilter),
      skip: 0,
    }));
  };

  // Actions
  const handleView = (material: MaterialWithSuppliers) => {
    setSelectedMaterial(material);
    setViewDialogOpen(true);
  };

  const handleEdit = (material: MaterialWithSuppliers) => {
    setSelectedMaterial(material);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (material: MaterialWithSuppliers) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMaterial) return;

    try {
      await deleteMaterial.mutateAsync(selectedMaterial.id);
      toast.success(t("data.materials.toasts.deleted.title") || "Material deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete material");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      await bulkDelete.mutateAsync({ ids: Array.from(selectedIds) });
      toast.success(`Deleted ${selectedIds.size} material(s) successfully`);
      setSelectedIds(new Set());
      setBulkSelectMode(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete materials");
    }
  };

  const handleExport = async () => {
    try {
      await exportMaterials.mutateAsync(filters);
      // Download handled automatically in the hook
    } catch (error) {
      toast.error("Failed to export materials");
    }
  };

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

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      supplierId: "",
      stockStatus: undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
      skip: 0,
      take: 50,
    });
  };

  const hasActiveFilters = !!(filters.search || filters.category || filters.stockStatus);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border-destructive rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-destructive h-5 w-5" />
          <p className="text-destructive text-sm">Error loading materials: {error.message}</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">{t("data.materials.title") || "Materials"}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exportMaterials.isPending}
              >
                {exportMaterials.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>
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
                    Select
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
                placeholder={t("common.search") || "Search..."}
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <Select value={filters.category || "all"} onValueChange={handleCategoryFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category ?? "none"}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Stock Status Filter */}
              <Select value={filters.stockStatus ?? "all"} onValueChange={handleStockStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Stock Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="overstocked">Overstocked</SelectItem>
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
              <div className="bg-muted/50 mr-2 flex items-center gap-2 rounded-lg border p-3">
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
              {t("common.of") || "of"} {total} {t("data.materials.title") || "materials"}
            </p>
          </div>

          {/* Materials Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {processedMaterials.map((material) => {
              const currentStock = Number(material.currentStock);
              const minStock = Number(material.minStock);
              const maxStock = Number(material.maxStock);
              const stockStatus = getStockStatus(currentStock, minStock, maxStock);
              const isSelected = selectedIds.has(material.id);
              const primarySupplier =
                material.materialSuppliers?.find((s) => s.isPreferred) ||
                material.materialSuppliers?.[0];

              return (
                <Card
                  key={material.id}
                  className={`group bg-card relative rounded-lg border px-0 py-4 shadow-sm transition-all hover:shadow-md ${
                    isSelected ? "ring-primary ring-2" : ""
                  }`}
                >
                  {/* Bulk Select Checkbox */}
                  {bulkSelectMode && (
                    <div className="absolute top-4 left-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectItem(material.id)}
                      />
                    </div>
                  )}

                  {/* Material Content */}
                  <CardContent className={`${bulkSelectMode ? "pl-8" : ""}`}>
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="w-[85px] truncate text-sm leading-tight font-semibold">
                          {material.name}
                        </h3>
                        {material.sku && (
                          <p className="text-muted-foreground text-xs">SKU: {material.sku}</p>
                        )}
                      </div>

                      {/* Stock Status Badge */}
                      <Badge
                        variant={getStockStatusVariant(stockStatus)}
                        className="ml-auto text-xs"
                      >
                        {stockStatus}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Material Info */}
                    <div className="text-muted-foreground my-2 space-y-1 text-xs">
                      {material.category && (
                        <div className="flex justify-between">
                          <span>{t("common.category")}:</span>
                          <span className="text-foreground font-medium">{material.category}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>{t("common.stock")}:</span>
                        <span className="text-foreground font-medium">
                          {currentStock} {material.unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unit Cost:</span>
                        <span className="text-foreground font-medium">
                          ${Number(material.unitCost).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Supplier:</span>
                        <span className="text-foreground font-medium">
                          {primarySupplier ? primarySupplier.supplier.name : "N/A"}
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
                              onClick={() => handleView(material)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Details</p>
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
                            <p>Edit</p>
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
                            <p>Delete</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {/* Empty State */}
            {processedMaterials.length === 0 && (
              <div className="col-span-full flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <PackageOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">
                  {t("messages.noMaterialsFound") || "No materials found"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {hasActiveFilters
                    ? t("messages.noMatchingFilters") ||
                      "Try adjusting your filters or search query"
                    : t("messages.getStartedMaterial") ||
                      "Get started by adding your first material"}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    {t("common.actions.clearFilters") || "Clear Filters"}
                  </Button>
                ) : (
                  <AddMaterialDialog />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <MaterialDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        material={selectedMaterial}
        onEdit={handleEdit}
        onDelete={(id) => {
          const material = materials.find((m) => m.id === id);
          if (material) handleDeleteClick(material);
        }}
      />

      <EditMaterialDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        material={selectedMaterial}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("data.materials.deleteConfirm.title") || "Delete Material"}
        description={
          t("data.materials.deleteConfirm.description") ||
          `Are you sure you want to delete "${selectedMaterial?.name}"? This action cannot be undone.`
        }
        confirmText={t("actions.delete") || "Delete"}
        cancelText={t("actions.cancel") || "Cancel"}
        variant="destructive"
      />

      <ConfirmationDialog
        open={bulkSelectMode && selectedIds.size > 0 && false}
        onOpenChange={() => {}}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Materials"
        description={`Are you sure you want to delete ${selectedIds.size} material(s)? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
