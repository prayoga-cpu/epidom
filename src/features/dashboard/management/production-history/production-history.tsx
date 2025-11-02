"use client";

import { useState, useMemo } from "react";
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
import { MOCK_PRODUCTION_BATCHES, MOCK_RECIPES } from "@/mocks";
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
  AlertCircle,
  Clock,
  Eye
} from "lucide-react";
import { ProductionBatch } from "@/types/entities";
import { BatchDetailsDialog } from "./batch-details-dialog";
import { ProductionMetricsCards } from "./production-metrics-cards";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

export function ProductionHistoryCard() {
  const { t } = useI18n();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [recipeFilter, setRecipeFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortField, setSortField] = useState<keyof ProductionBatch | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [isBatchDetailsOpen, setIsBatchDetailsOpen] = useState(false);

  // Filter batches
  const filteredBatches = useMemo(() => {
    let filtered = [...MOCK_PRODUCTION_BATCHES];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((batch) =>
        batch.batchNumber.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter && statusFilter !== "ALL") {
      filtered = filtered.filter((batch) => batch.status === statusFilter);
    }

    // Recipe filter
    if (recipeFilter && recipeFilter !== "ALL") {
      filtered = filtered.filter((batch) => batch.recipeId === recipeFilter);
    }

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter((batch) => batch.startedAt && new Date(batch.startedAt) >= dateRange.from!);
    }
    if (dateRange?.to) {
      filtered = filtered.filter((batch) => batch.startedAt && new Date(batch.startedAt) <= dateRange.to!);
    }

    return filtered;
  }, [searchQuery, statusFilter, recipeFilter, dateRange]);

  // Sort batches
  const sortedBatches = useMemo(() => {
    if (!sortField) return filteredBatches;

    return [...filteredBatches].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null or undefined values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Convert dates to timestamps for comparison
      if (sortField === "startedAt" || sortField === "completedAt") {
        aVal = new Date(aVal as string | Date).getTime();
        bVal = new Date(bVal as string | Date).getTime();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredBatches, sortField, sortDirection]);

  // Paginate batches
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedBatches.slice(startIndex, startIndex + pageSize);
  }, [sortedBatches, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedBatches.length / pageSize);

  // Handle sort
  const handleSort = (field: keyof ProductionBatch) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Get recipe name
  const getRecipeName = (recipeId: string) => {
    const recipe = MOCK_RECIPES.find((r) => r.id === recipeId);
    return recipe?.name || recipeId;
  };

  // Get status configuration
  const getStatusConfig = (status: string) => {
    const configs = {
      PENDING: {
        label: t("management.productionHistory.statuses.pending"),
        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        icon: Clock,
      },
      IN_PROGRESS: {
        label: t("management.productionHistory.statuses.inProgress"),
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
        icon: Loader2,
      },
      QUALITY_CHECK: {
        label: t("management.productionHistory.statuses.qualityCheck"),
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
        icon: AlertCircle,
      },
      COMPLETED: {
        label: t("management.productionHistory.statuses.completed"),
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        icon: CheckCircle,
      },
      FAILED: {
        label: t("management.productionHistory.statuses.failed"),
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        icon: XCircle,
      },
    };
    return configs[status as keyof typeof configs] || configs.PENDING;
  };

  // Render sort icon
  const renderSortIcon = (field: keyof ProductionBatch) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  // Handle view batch details
  const handleViewBatch = (batch: ProductionBatch) => {
    setSelectedBatch(batch);
    setIsBatchDetailsOpen(true);
  };

  // Prepare export data
  const exportData = sortedBatches.map((batch) => ({
    [t("management.productionHistory.batchNumber")]: batch.batchNumber,
    [t("management.productionHistory.recipe")]: getRecipeName(batch.recipeId),
    [t("management.productionHistory.status")]: getStatusConfig(batch.status).label,
    [t("management.productionHistory.metrics.plannedQuantity")]: batch.quantityPlanned,
    [t("management.productionHistory.metrics.producedQuantity")]: batch.quantityProduced,
    [t("management.productionHistory.qualityScore")]: batch.qualityScore ?? t("common.notAvailable"),
    [t("management.productionHistory.startedAt")]: batch.startedAt ? format(new Date(batch.startedAt as string | Date), "yyyy-MM-dd HH:mm") : t("common.notAvailable"),
    [t("management.productionHistory.completedAt")]: batch.completedAt
      ? format(new Date(batch.completedAt), "yyyy-MM-dd HH:mm")
      : t("common.notAvailable"),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("tabs.productionHistory")}
        </h2>
        <p className="text-muted-foreground">
          {t("management.productionHistory.description")}
        </p>
      </div>

      {/* Metrics Cards */}
      <ProductionMetricsCards batches={filteredBatches} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {t("management.productionHistory.filters")}
              </CardTitle>
              <CardDescription>
                {t("management.productionHistory.filtersDescription")}
              </CardDescription>
            </div>
            <ExportButton
              data={exportData}
              filename="production-history"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("management.productionHistory.searchBatches")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("management.productionHistory.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("management.productionHistory.allStatuses")}</SelectItem>
                <SelectItem value="pending">{t("management.productionHistory.statuses.pending")}</SelectItem>
                <SelectItem value="in_progress">{t("management.productionHistory.statuses.inProgress")}</SelectItem>
                <SelectItem value="quality_check">{t("management.productionHistory.statuses.qualityCheck")}</SelectItem>
                <SelectItem value="completed">{t("management.productionHistory.statuses.completed")}</SelectItem>
                <SelectItem value="failed">{t("management.productionHistory.statuses.failed")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Recipe Filter */}
            <Select value={recipeFilter} onValueChange={setRecipeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("management.productionHistory.selectRecipe")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("management.productionHistory.allRecipes")}</SelectItem>
                {MOCK_RECIPES.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          {/* Active Filters */}
          {(searchQuery || statusFilter !== "ALL" || recipeFilter !== "ALL" || dateRange?.from) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("management.productionHistory.activeFilters")}:
              </span>
              {searchQuery && (
                <Badge variant="secondary">
                  {t("management.productionHistory.search")}: {searchQuery}
                </Badge>
              )}
              {statusFilter !== "ALL" && (
                <Badge variant="secondary">
                  {t("management.productionHistory.status")}: {getStatusConfig(statusFilter).label}
                </Badge>
              )}
              {recipeFilter !== "ALL" && (
                <Badge variant="secondary">
                  {t("management.productionHistory.recipe")}: {getRecipeName(recipeFilter)}
                </Badge>
              )}
              {dateRange?.from && (
                <Badge variant="secondary">
                  {t("management.productionHistory.dateRange")}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {t("management.productionHistory.batchesList")} ({sortedBatches.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("management.productionHistory.rowsPerPage")}:
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20">
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
        <CardContent>
          {paginatedBatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t("management.productionHistory.noBatchesFound")}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("batchNumber")}
                    >
                      <div className="flex items-center">
                        {t("management.productionHistory.batchNumber")}
                        {renderSortIcon("batchNumber")}
                      </div>
                    </TableHead>
                    <TableHead>{t("management.productionHistory.recipe")}</TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        {t("management.productionHistory.status")}
                        {renderSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      {t("management.productionHistory.quantity")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("management.productionHistory.qualityScore")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("startedAt")}
                    >
                      <div className="flex items-center">
                        {t("management.productionHistory.startedAt")}
                        {renderSortIcon("startedAt")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      {t("management.productionHistory.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBatches.map((batch) => {
                    const statusConfig = getStatusConfig(batch.status);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow
                        key={batch.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewBatch(batch)}
                      >
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>{getRecipeName(batch.recipeId)}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.quantityProduced} / {batch.quantityPlanned}
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.qualityScore !== null && batch.qualityScore !== undefined ? batch.qualityScore.toFixed(1) : t("common.notAvailable")}
                        </TableCell>
                        <TableCell>
                          {batch.startedAt ? format(new Date(batch.startedAt as string | Date), "MMM d, yyyy HH:mm") : t("common.notAvailable")}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t("management.productionHistory.showing")} {(currentPage - 1) * pageSize + 1} -{" "}
                    {Math.min(currentPage * pageSize, sortedBatches.length)} {t("common.of")}{" "}
                    {sortedBatches.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("common.actions.previous")}
                    </Button>
                    <span className="text-sm">
                      {t("common.page")} {currentPage} {t("common.of")} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      {t("common.actions.next")}
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
