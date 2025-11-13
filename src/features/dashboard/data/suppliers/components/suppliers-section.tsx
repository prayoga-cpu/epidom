"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/components/lang/i18n-provider";
import SupplierDetailsDialog from "./supplier-details-dialog";
import EditSupplierDialog from "./edit-supplier-dialog";
import AddSupplierDialog from "./add-supplier-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Search,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  Store,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  useSuppliers,
  useDeleteSupplier,
  useBulkDeleteSuppliers,
  useExportSuppliers,
} from "../hooks/use-suppliers";
import { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ItemCardGrid,
  BaseItemCard,
  ActionButtons,
  ActionButton,
} from "../../components";
import { SectionLoadingSkeleton } from "@/features/dashboard/shared/components/loading-states";
import { SectionErrorState } from "@/features/dashboard/shared/components/error-states";
import { responsive, responsiveText } from "@/lib/utils/responsive";

export function SuppliersSection() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const storeId = params.storeId as string;
  const { supplierManagementAccess, advancedReportsAccess, isLoading: isLoadingAccess } =
    useFeatureAccess();

  // Search input state (for immediate UI feedback)
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Filters and pagination state
  const [filters, setFilters] = useState({
    search: "",
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
    skip: 0,
    take: 20,
  });

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch, skip: 0 }));
  }, [debouncedSearch]);

  // UI state
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithRelations | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // API hooks
  const { data, isLoading, error, refetch } = useSuppliers(storeId, filters);
  const deleteSupplier = useDeleteSupplier(storeId);
  const bulkDeleteSuppliers = useBulkDeleteSuppliers(storeId);
  const exportSuppliers = useExportSuppliers();

  const suppliers = data?.suppliers || [];
  const totalSuppliers = data?.total || 0;
  const currentPage = Math.floor(filters.skip / filters.take) + 1;
  const totalPages = Math.ceil(totalSuppliers / filters.take);

  // Bulk selection handlers
  const toggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === suppliers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suppliers.map((s) => s.id)));
    }
  };


  // Action handlers
  const handleView = (supplier: SupplierWithRelations) => {
    setSelectedSupplier(supplier);
    setViewDialogOpen(true);
  };

  const handleEdit = (supplier: SupplierWithRelations) => {
    setSelectedSupplier(supplier);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (supplier: SupplierWithRelations) => {
    setSelectedSupplier(supplier);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSupplier) return;

    try {
      await deleteSupplier.mutateAsync(selectedSupplier.id);
      toast.success(t("data.suppliers.toasts.deleted.title"));
      setDeleteDialogOpen(false);
      setSelectedSupplier(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.failedToDeleteSupplier"));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      await bulkDeleteSuppliers.mutateAsync(Array.from(selectedIds));
      toast.success(
        t("data.suppliers.toasts.bulkDeleted.description")?.replace("{count}", selectedIds.size.toString()) || ""
      );
      setSelectedIds(new Set());
      setBulkSelectMode(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.failedToDeleteSuppliers"));
    }
  };

  const handleExport = async () => {
    try {
      await exportSuppliers.mutateAsync({ storeId, filters });
      toast.success(t("messages.exportSuccessful"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.errorLoadingSuppliers"));
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
      sortBy: "createdAt",
      sortOrder: "desc",
      skip: 0,
      take: 20,
    });
  };

  const hasActiveFilters = filters.search;

  // Show loading state
  if (isLoading || isLoadingAccess) {
    return (
      <SectionLoadingSkeleton
        title={t("data.suppliers.pageTitle")}
        exportLabel={t("common.actions.export")}
        addLabel={t("data.suppliers.addButton")}
        selectLabel={t("common.actions.select")}
      />
    );
  }

  // Show upgrade prompt if no access (from hook or from API error 403)
  const isSubscriptionLocked =
    (!isLoadingAccess && !supplierManagementAccess) ||
    (error && ((error as any).code === "SUBSCRIPTION_FEATURE_LOCKED" || (error as any).status === 403));

  if (isSubscriptionLocked) {
    return (
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-bold">
            {t("data.suppliers.pageTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[400px] flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground text-center">
            {t("data.suppliers.locked")}
          </p>
          <Button
            onClick={() => router.push("/pricing")}
            className="bg-[var(--color-brand-primary)] hover:opacity-90"
          >
            {t("billing.upgradeToPro")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show error state for other errors
  if (error) {
    return (
      <SectionErrorState
        error={error}
        onRetry={() => refetch()}
        title={t("common.error")}
        description={t("messages.errorLoadingSuppliers")}
      />
    );
  }

  return (
    <>
      <Card className={responsive.cardWrapper}>
        <CardHeader className={responsive.cardHeader}>
          <div className={responsive.header}>
            <CardTitle className={responsiveText.title}>
              {t("data.suppliers.pageTitle")}
            </CardTitle>
            <ActionButtons>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exportSuppliers.isPending || !advancedReportsAccess}
                  >
                    {exportSuppliers.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {t("common.actions.export")}
                  </ActionButton>
                </TooltipTrigger>
                {!advancedReportsAccess && (
                  <TooltipContent>
                    <p>{t("billing.advancedReportsOnly")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <AddSupplierDialog>
                <ActionButton size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("data.suppliers.addButton")}
                </ActionButton>
              </AddSupplierDialog>
              {bulkSelectMode && selectedIds.size > 0 && (
                <ActionButton variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.actions.delete")} ({selectedIds.size})
                </ActionButton>
              )}
              <ActionButton
                variant={bulkSelectMode ? "default" : "outline"}
                size="sm"
                onClick={toggleBulkSelect}
              >
                {bulkSelectMode ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    {t("common.actions.cancel")}
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {t("common.actions.select")}
                  </>
                )}
              </ActionButton>
            </ActionButtons>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative w-full">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("data.suppliers.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderSortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">{t("sort.nameAZ")}</SelectItem>
                  <SelectItem value="name-desc">{t("sort.nameZA")}</SelectItem>
                  <SelectItem value="contactPerson-asc">
                    {t("sort.contactAZ")}
                  </SelectItem>
                  <SelectItem value="contactPerson-desc">
                    {t("sort.contactZA")}
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
                <ActionButton variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  {t("common.actions.clearFilters")}
                </ActionButton>
              )}
            </div>

            {/* Bulk Select All */}
            {bulkSelectMode && (
              <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
                <Checkbox
                  checked={selectedIds.size === suppliers.length && suppliers.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("common.selectAll")} ({selectedIds.size}{" "}
                  {t("common.of")} {suppliers.length} {t("common.selected")})
                </span>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing")} {suppliers.length} {t("common.of")} {totalSuppliers}{" "}
              {t("data.suppliers.pageTitle")}
            </p>
          </div>

          {/* Suppliers Grid */}
          <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
            {suppliers.map((supplier) => {
              const isSelected = selectedIds.has(supplier.id);

              return (
                <BaseItemCard
                  key={supplier.id}
                  isSelected={isSelected}
                  bulkSelectMode={bulkSelectMode}
                  onSelect={(checked) => {
                    if (checked) {
                      setSelectedIds((prev) => new Set(prev).add(supplier.id));
                    } else {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(supplier.id);
                        return next;
                      });
                    }
                  }}
                  contentClassName="!px-4"
                >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm leading-tight font-semibold">{supplier.name}</h3>
                        {supplier.contactPerson && (
                          <p className="text-muted-foreground text-xs">{supplier.contactPerson}</p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Supplier Info */}
                    <div className="text-muted-foreground my-2 space-y-1 text-xs">
                      {supplier.email && (
                        <div className="flex justify-between">
                          <span>{t("common.email")}:</span>
                          <span className="text-foreground truncate font-medium">
                            {supplier.email.split("@")[0]}...
                          </span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex justify-between">
                          <span>{t("common.phone")}:</span>
                          <span className="text-foreground font-medium">{supplier.phone}</span>
                        </div>
                      )}
                      {(supplier.city || supplier.country) && (
                        <div className="flex justify-between">
                          <span>{t("common.location")}:</span>
                          <span className="text-foreground font-medium">
                            {[supplier.city, supplier.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>{t("data.materials.pageTitle")}:</span>
                        <span className="text-foreground font-medium">
                          {supplier.materialSuppliers?.length ?? 0}
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
                              onClick={() => handleView(supplier)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.suppliers.tooltips.view")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 w-full flex-1 text-xs"
                              onClick={() => handleEdit(supplier)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.suppliers.tooltips.edit")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive bg-destructive/10 hover:bg-destructive/30 h-8 w-full flex-1 text-xs"
                              onClick={() => handleDeleteClick(supplier)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("data.suppliers.tooltips.delete")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                </BaseItemCard>
              );
            })}
          </ItemCardGrid>

          {/* Empty State */}
          {suppliers.length === 0 && (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Store className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">
                  {t("messages.noSuppliersFound")}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {hasActiveFilters
                    ? t("messages.noMatchingFilters")
                    : t("messages.getStartedSupplier")}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    {t("common.actions.clearFilters")}
                  </Button>
                ) : (
                  <AddSupplierDialog />
                )}
              </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("pagination.rowsPerPage")}:
                </span>
                <Select
                  value={filters.take.toString()}
                  onValueChange={(value) => handlePageSizeChange(Number(value))}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue placeholder={filters.take.toString()} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 50, 100].map((pageSize) => (
                      <SelectItem key={pageSize} value={pageSize.toString()}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <span className="text-muted-foreground text-sm">
                  {t("pagination.page")} {currentPage} {t("pagination.of")} {totalPages}
                </span>
                <div className="flex items-center gap-1">
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
      {selectedSupplier && (
        <>
          <SupplierDetailsDialog
            supplier={selectedSupplier}
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
          <EditSupplierDialog
            supplier={selectedSupplier}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <ConfirmationDialog
            title={t("data.suppliers.toasts.deleted.title")}
            description={t("data.suppliers.toasts.deleted.description")?.replace(
              "{name}",
              selectedSupplier.name
            ) || ""}
            confirmText={t("common.actions.delete")}
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
