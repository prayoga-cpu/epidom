"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Loader2,
  XCircle,
  Clock,
  Eye,
  Ban,
  AlertCircle,
} from "lucide-react";
import { ProductionBatch } from "@/types/entities";
import { BatchDetailsDialog } from "./batch-details-dialog";
import { ProductionMetricsCards } from "./production-metrics-cards";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useProductionBatches } from "../recipe-production/hooks/use-production-batches";
import { useRecipes } from "@/features/dashboard/data/recipes/hooks/use-recipes";

export function ProductionHistoryCard() {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [recipeFilter, setRecipeFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortField, setSortField] = useState<"batchNumber" | "scheduledDate" | "status">(
    "scheduledDate"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [isBatchDetailsOpen, setIsBatchDetailsOpen] = useState(false);

  // Fetch production batches from API
  const { data: batchesData, isLoading: batchesLoading } = useProductionBatches(storeId, {
    search: searchQuery || undefined,
    /**
     * Type assertion needed because statusFilter is string but filter expects ProductionStatus[]
     * Actual type: ProductionStatus[]
     * TODO: Use proper type guard or update filter type
     */
    status: statusFilter !== "ALL" ? [statusFilter as any] : undefined,
    recipeId: recipeFilter !== "ALL" ? recipeFilter : undefined,
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    /**
     * Type assertion needed because sortField is string but filter expects specific union type
     * Actual type: "createdAt" | "scheduledDate" | "completedDate" | "status"
     * TODO: Use proper type guard or update filter type
     */
    sortBy: sortField as any,
    sortOrder: sortDirection,
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  // Fetch recipes for filter dropdown
  const { data: recipesData } = useRecipes(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    skip: 0,
    take: 100,
  });

  const allBatches = batchesData?.batches || [];
  const totalBatches = batchesData?.total || 0;
  const recipes = recipesData?.recipes || [];

  const totalPages = Math.ceil(totalBatches / pageSize);

  // Handle sort
  const handleSort = (field: "batchNumber" | "scheduledDate" | "status") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Get recipe name
  const getRecipeName = (recipeId: string | null) => {
    if (!recipeId) return t("common.notAvailable") || "N/A";
    const recipe = recipes.find((r) => r.id === recipeId);
    return recipe?.name || recipeId;
  };

  // Get status configuration with neutral colors
  const getStatusConfig = (status: string) => {
    const configs = {
      PLANNED: {
        label: t("management.productionHistory.statuses.planned") || "Planned",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
        icon: Clock,
      },
      IN_PROGRESS: {
        label: t("management.productionHistory.statuses.inProgress") || "In Progress",
        color: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-50",
        icon: Loader2,
      },
      COMPLETED: {
        label: t("management.productionHistory.statuses.completed") || "Completed",
        color: "bg-gray-300 text-gray-950 dark:bg-gray-600 dark:text-white",
        icon: CheckCircle,
      },
      CANCELLED: {
        label: t("management.productionHistory.statuses.cancelled") || "Cancelled",
        color: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
        icon: Ban,
      },
    };
    return configs[status as keyof typeof configs] || configs.PLANNED;
  };

  // Render sort icon
  const renderSortIcon = (field: "batchNumber" | "scheduledDate" | "status") => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  // Handle view batch details
  const handleViewBatch = (batch: any) => {
    setSelectedBatch(batch);
    setIsBatchDetailsOpen(true);
  };

  // Prepare export data
  const exportData = allBatches.map((batch) => ({
    [t("management.productionHistory.batchNumber")]: batch.batchNumber,
    [t("management.productionHistory.recipe")]:
      batch.product?.name || getRecipeName(batch.recipeId || ""),
    [t("management.productionHistory.status")]: getStatusConfig(batch.status).label,
    [t("management.productionHistory.metrics.plannedQuantity")]: batch.plannedQuantity,
    [t("management.productionHistory.metrics.producedQuantity")]: batch.actualQuantity || 0,
    [t("management.productionHistory.unit")]: batch.unit,
    [t("management.productionHistory.startedAt")]: batch.scheduledDate
      ? format(new Date(batch.scheduledDate), "yyyy-MM-dd HH:mm")
      : t("common.notAvailable"),
    [t("management.productionHistory.completedAt")]: batch.completedDate
      ? format(new Date(batch.completedDate), "yyyy-MM-dd HH:mm")
      : t("common.notAvailable"),
  }));

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="text-left">
        <h2 className="text-2xl font-bold tracking-tight">{t("tabs.productionHistory")}</h2>
        <p className="text-muted-foreground text-sm">{t("management.productionHistory.description")}</p>
      </div>

      {/* Metrics Cards */}
      {/**
       * Type assertion needed because ProductionMetricsCards expects specific batch type
       * Actual type: ProductionBatchWithRelations[]
       * TODO: Update ProductionMetricsCards to accept proper type or create type adapter
       */}
      <ProductionMetricsCards batches={allBatches as any} />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">{t("management.productionHistory.filters")}</CardTitle>
              <CardDescription>
                {t("management.productionHistory.filtersDescription")}
              </CardDescription>
            </div>
            <div className="flex w-full justify-start md:w-auto md:justify-end">
              <ExportButton data={exportData} filename="production-history" size="sm" className="w-full md:w-auto" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          <div className="space-y-2 md:space-y-3">
            {/* Search */}
            <div className="relative w-full">
              <Search className="text-muted-foreground/80 absolute top-2 left-2.5 h-4.5 w-4.5" />
              <Input
                placeholder={t("management.productionHistory.searchBatches")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
              />
            </div>
            <div className="flex w-full flex-wrap gap-2">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder={t("management.productionHistory.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {t("management.productionHistory.allStatuses")}
                  </SelectItem>
                  <SelectItem value="PLANNED">
                    {t("management.productionHistory.statuses.planned") || "Planned"}
                  </SelectItem>
                  <SelectItem value="IN_PROGRESS">
                    {t("management.productionHistory.statuses.inProgress") || "In Progress"}
                  </SelectItem>
                  <SelectItem value="COMPLETED">
                    {t("management.productionHistory.statuses.completed") || "Completed"}
                  </SelectItem>
                  <SelectItem value="CANCELLED">
                    {t("management.productionHistory.statuses.cancelled") || "Cancelled"}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Recipe Filter */}
              <Select value={recipeFilter} onValueChange={setRecipeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder={t("management.productionHistory.selectRecipe")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {t("management.productionHistory.allRecipes")}
                  </SelectItem>
                  {recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <div className="w-full md:w-auto">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {(searchQuery || statusFilter !== "ALL" || recipeFilter !== "ALL" || dateRange?.from) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t("management.productionHistory.activeFilters")}:
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  {t("management.productionHistory.search")}: {searchQuery}
                </Badge>
              )}
              {statusFilter !== "ALL" && (
                <Badge variant="secondary" className="text-xs">
                  {t("management.productionHistory.status")}: {getStatusConfig(statusFilter).label}
                </Badge>
              )}
              {recipeFilter !== "ALL" && (
                <Badge variant="secondary" className="text-xs">
                  {t("management.productionHistory.recipe")}: {getRecipeName(recipeFilter)}
                </Badge>
              )}
              {dateRange?.from && (
                <Badge variant="secondary" className="text-xs">{t("management.productionHistory.dateRange")}</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setRecipeFilter("ALL");
                  setDateRange(undefined);
                }}
              >
                {t("common.actions.clearFilters")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg">
              {t("management.productionHistory.batchesList")} ({totalBatches})
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t("management.productionHistory.rowsPerPage")}:
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {batchesLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
              <p className="text-muted-foreground mt-2 text-sm">{t("common.loading")}</p>
            </div>
          ) : allBatches.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p className="text-sm">{t("management.productionHistory.noBatchesFound")}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("batchNumber")}>
                      <div className="flex items-center">
                        {t("management.productionHistory.batchNumber")}
                        {renderSortIcon("batchNumber")}
                      </div>
                    </TableHead>
                    <TableHead>{t("management.productionHistory.recipe")}</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                      <div className="flex items-center">
                        {t("management.productionHistory.status")}
                        {renderSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      {t("management.productionHistory.quantity")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("scheduledDate")}
                    >
                      <div className="flex items-center">
                        {t("management.productionHistory.scheduledDate") || "Scheduled"}
                        {renderSortIcon("scheduledDate")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      {t("management.productionHistory.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBatches.map((batch) => {
                    const statusConfig = getStatusConfig(batch.status);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow
                        key={batch.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleViewBatch(batch)}
                      >
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>
                          {batch.product?.name || getRecipeName(batch.recipeId)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon
                              className={`mr-1 h-3 w-3 ${batch.status === "IN_PROGRESS" ? "animate-spin" : ""}`}
                            />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.actualQuantity || 0} / {batch.plannedQuantity} {batch.unit}
                        </TableCell>
                        <TableCell>
                          {batch.scheduledDate
                            ? format(new Date(batch.scheduledDate), "MMM d, yyyy HH:mm")
                            : t("common.notAvailable")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewBatch(batch);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-muted-foreground text-sm">
                    {t("management.productionHistory.showing")} {(currentPage - 1) * pageSize + 1} -{" "}
                    {Math.min(currentPage * pageSize, totalBatches)} {t("common.of")} {totalBatches}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-9 text-sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("common.actions.previous")}</span>
                    </Button>
                    <span className="text-sm">
                      {t("common.page")} {currentPage} {t("common.of")} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-9 text-sm"
                    >
                      <span className="hidden sm:inline">{t("common.actions.next")}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Batch Details Dialog */}
      {selectedBatch && (
        <BatchDetailsDialog
          open={isBatchDetailsOpen}
          onOpenChange={setIsBatchDetailsOpen}
          batch={selectedBatch}
        />
      )}
    </div>
  );
}
