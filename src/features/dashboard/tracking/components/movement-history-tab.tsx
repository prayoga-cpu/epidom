"use client";

import { useState } from "react";
import { ExportButton } from "@/components/ui/export-button";
import { useI18n } from "@/components/lang/i18n-provider";
import { MOCK_STOCK_MOVEMENTS } from "@/mocks";
import { MovementFiltersComponent, type MovementFilters } from "./movement-filters";
import { MovementsTable } from "./movements-table";
import { AddMovementDialog } from "./add-movement-dialog";
import type { StockMovement } from "@/types/entities";

interface MovementHistoryTabProps {
  onMovementClick: (movement: StockMovement) => void;
}

export function MovementHistoryTab({ onMovementClick }: MovementHistoryTabProps) {
  const { t } = useI18n();

  // State & Filters
  const [movementFilters, setMovementFilters] = useState<MovementFilters>({
    search: "",
    types: [],
    dateRange: undefined,
  });

  // Pagination state (for backend API)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // TODO: Replace with TanStack Query hook for fetching movements
  // Example implementation:
  // const { data: movementsData, isLoading, error, refetch } = useQuery({
  //   queryKey: ['movements', movementFilters, currentPage, pageSize],
  //   queryFn: () => fetchMovements({
  //     search: movementFilters.search,
  //     types: movementFilters.types,
  //     dateFrom: movementFilters.dateRange?.from?.toISOString(),
  //     dateTo: movementFilters.dateRange?.to?.toISOString(),
  //     page: currentPage,
  //     limit: pageSize,
  //   }),
  // });
  //
  // const movements = movementsData?.movements || [];
  // const totalCount = movementsData?.totalCount || 0;

  const handleApplyFilters = () => {
    console.log("Applying filters for TanStack Query:", {
      ...movementFilters,
      page: currentPage,
      limit: pageSize,
    });
    // When using TanStack Query, simply call refetch() or the query will auto-refetch
    // when dependencies in queryKey change
  };

  // TODO: Replace with data from TanStack Query (see useQuery hook above)
  // For now, using mock data:
  const movements: StockMovement[] = MOCK_STOCK_MOVEMENTS;

  // Export data
  const movementsExportData = movements.map((mov) => ({
    Date: new Date(mov.createdAt).toLocaleString(),
    Material: mov.materialId || "",
    Type: mov.type,
    Quantity: `${mov.quantity} ${mov.unit}`,
    Reason: mov.reason,
    User: mov.userName,
    Reference: mov.referenceId || "-",
  }));

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        {/* Filters */}
        <div className="mb-4">
          <MovementFiltersComponent
            filters={movementFilters}
            onFiltersChange={setMovementFilters}
            onApplyFilters={handleApplyFilters}
          />
        </div>

        {/* Header with Actions */}
        <div className="mb-4 flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-medium">{t("tracking.movementHistory")}</h2>
            <p className="text-muted-foreground text-sm">
              {(t("tracking.showingMovements") || "Showing {count} movements").replace("{count}", movements.length.toString())}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={movementsExportData}
              filename="stock-movements"
              variant="outline"
              size="sm"
            />
            <AddMovementDialog />
          </div>
        </div>

        {/* Movements Table */}
        <MovementsTable
          movements={movements}
          totalCount={movements.length} // TODO: Get from API response
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => {
            setCurrentPage(page);
            handleApplyFilters(); // Triggers API call with new page
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1); // Reset to first page
            handleApplyFilters(); // Triggers API call with new page size
          }}
          onSortChange={(field, order) => {
            console.log("Sort changed:", field, order);
            // TODO: With TanStack Query, sorting params should be in queryKey
            // Add sortField and sortOrder to state, then the query will auto-refetch
            // Example:
            // setSortField(field);
            // setSortOrder(order);
            // queryKey: ['movements', filters, page, pageSize, field, order]
          }}
          onRowClick={onMovementClick}
        />
      </div>
    </div>
  );
}
