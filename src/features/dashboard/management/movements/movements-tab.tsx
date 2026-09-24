"use client";

import { useRef, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FilterBar } from "@/features/dashboard/shared/components/filter-bar";
import type { SortDir } from "@/features/dashboard/shared/hooks/use-sortable";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { useDebounce } from "@/hooks/use-debounce";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { Loader2, ArrowDownCircle, ArrowUpCircle, Minus, ArrowUpDown } from "lucide-react";
import { MovementType } from "@prisma/client";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { unwrapApiData, unwrapApiError } from "@/lib/api/unwrap";
import { signedMovementQuantity } from "@/lib/utils/stock-movement";
import { cn } from "@/lib/utils";

interface Movement {
  id: string;
  type: MovementType;
  // Prisma Decimals arrive as strings.
  quantity: number | string;
  balanceAfter: number | string | null;
  unit: string;
  notes: string | null;
  reason: string | null;
  createdAt: string;
  material?: { name: string; sku: string | null } | null;
  product?: { name: string; sku: string | null } | null;
  order?: { orderNumber: string } | null;
  productionBatch?: { batchNumber: string } | null;
}

interface MovementsPage {
  movements: Movement[];
  nextCursor: string | null;
}

const PAGE_SIZE = 50;

const TYPE_COLORS: Record<MovementType, string> = {
  SALE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PRODUCTION_IN: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PRODUCTION_OUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ADJUSTMENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  PURCHASE: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  WASTE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  RETURN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

function sourceLabel(m: Movement): string | null {
  if (m.order) return `POS #${m.order.orderNumber}`;
  if (m.productionBatch) return `Batch #${m.productionBatch.batchNumber}`;
  return m.notes || null;
}

interface HistoryFilters {
  typeFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
  sortDir: SortDir;
}

const HISTORY_FILTER_DEFAULTS: HistoryFilters = {
  typeFilter: "ALL",
  dateFrom: null,
  dateTo: null,
  sortDir: "desc",
};

function sanitizeHistoryFilters(raw: unknown, defaults: HistoryFilters): HistoryFilters {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<HistoryFilters>;
  const validType =
    typeof r.typeFilter === "string" &&
    (r.typeFilter === "ALL" || (Object.values(MovementType) as string[]).includes(r.typeFilter));
  return {
    typeFilter: validType ? r.typeFilter! : "ALL",
    dateFrom: typeof r.dateFrom === "string" ? r.dateFrom : null,
    // Ranges saved before the end-of-day fix hold the last day's midnight,
    // which the API's `lte` would still cut off; endOfDay is idempotent.
    dateTo:
      typeof r.dateTo === "string" && !Number.isNaN(Date.parse(r.dateTo))
        ? endOfDay(new Date(r.dateTo)).toISOString()
        : null,
    sortDir: r.sortDir === "asc" ? "asc" : "desc",
  };
}

interface MovementsTabProps {
  storeId: string;
}

/**
 * The Stock page's Log: every stock movement of the store — sales, deliveries,
 * production, waste, adjustments and returns. Search, type, dates and order
 * all run on the server, and "Load more" pages through the whole history.
 */
export function MovementsTab({ storeId }: MovementsTabProps) {
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const search = useDebounce(searchQuery.trim(), 300);

  const [filters, setFilters] = usePersistedState<HistoryFilters>(
    `epidom-history-filters-${storeId}`,
    HISTORY_FILTER_DEFAULTS,
    sanitizeHistoryFilters
  );

  const logKey = ["stock-movements", storeId, "all"] as const;
  const query = useInfiniteQuery({
    queryKey: [
      ...logKey,
      filters.typeFilter,
      filters.dateFrom,
      filters.dateTo,
      filters.sortDir,
      search,
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ take: String(PAGE_SIZE), order: filters.sortDir });
      if (filters.typeFilter !== "ALL") params.set("type", filters.typeFilter);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (search) params.set("q", search);
      if (pageParam) params.set("cursor", pageParam);

      const response = await fetch(`/api/stores/${storeId}/stock-movements?${params.toString()}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(unwrapApiError(body).message || "Failed to load the stock log");
      }
      return unwrapApiData<MovementsPage>(body);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!storeId,
    staleTime: 15 * 1000,
    // Refetching an infinite query refetches every page loaded, so the Log
    // only stays live on its first page; paging back into history pauses it.
    refetchInterval: (q) => ((q.state.data?.pages.length ?? 0) > 1 ? false : 30 * 1000),
  });

  const pagesLoaded = useRef(0);
  pagesLoaded.current = query.data?.pages.length ?? 0;
  useRealtimeChannel(storeId, {
    [REALTIME_EVENTS.STOCK_CHANGED]: () => {
      // cancelRefetch: false — a sale landing mid "Load more" would otherwise
      // cancel that page load and quietly drop the tap.
      if (pagesLoaded.current <= 1)
        queryClient.invalidateQueries({ queryKey: logKey }, { cancelRefetch: false });
    },
  });

  const movements = query.data?.pages.flatMap((page) => page.movements) ?? [];

  const hasActiveFilters = filters.typeFilter !== "ALL" || !!filters.dateFrom || !!filters.dateTo;

  const clearFilters = () => {
    setFilters((prev) => ({ ...prev, typeFilter: "ALL", dateFrom: null, dateTo: null }));
  };

  const typeLabel = (type: MovementType) => t(`management.movementLog.types.${type}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar
          className="sm:flex-1"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t("tracking.movements.searchPlaceholder") || "Search item…"}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          clearLabel={t("management.editStock.clearFilters")}
        >
          <Select
            value={filters.typeFilter}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, typeFilter: v }))}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("filters.allTypes") || "All types"}</SelectItem>
              {Object.values(MovementType).map((v) => (
                <SelectItem key={v} value={v}>
                  {typeLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker
            value={{
              from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
              to: filters.dateTo ? new Date(filters.dateTo) : undefined,
            }}
            // Whole days: the picker hands back midnight, and the API's `lte`
            // would otherwise drop everything on the last day of the range.
            onChange={(range) =>
              setFilters((prev) => ({
                ...prev,
                dateFrom: range?.from ? startOfDay(range.from).toISOString() : null,
                dateTo: range?.to ? endOfDay(range.to).toISOString() : null,
              }))
            }
          />
        </FilterBar>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setFilters((prev) => ({ ...prev, sortDir: prev.sortDir === "desc" ? "asc" : "desc" }))
          }
          className="shrink-0"
        >
          <ArrowUpDown className="mr-1 h-4 w-4" />
          {filters.sortDir === "desc" ? t("sort.newest") : t("sort.oldest")}
        </Button>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : movements.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {t("tracking.movements.empty") || "No movements found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="divide-y rounded-lg border" data-testid="movement-log">
            {movements.map((m) => {
              const qty = signedMovementQuantity(m);
              const isOut = qty < 0;
              const source = sourceLabel(m);
              const details = [
                source,
                m.reason !== source ? m.reason : null,
                formatDateTime(m.createdAt),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={m.id}
                  data-testid="movement-row"
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <div
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full p-1.5",
                      isOut ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"
                    )}
                  >
                    {isOut ? (
                      <ArrowDownCircle className="h-4 w-4" />
                    ) : qty === 0 ? (
                      <Minus className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {m.material?.name ?? m.product?.name ?? "—"}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          isOut ? "text-red-600" : "text-green-600"
                        )}
                      >
                        {qty > 0 ? "+" : ""}
                        {qty} {m.unit}
                      </span>
                    </div>
                    {/* The badge sits here, not beside the name, so a long
                        label ("Used in production") never squeezes the name.
                        On a phone the details wrap to a line of their own;
                        from sm they sit between the badge and the balance. */}
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <Badge className={cn("shrink-0 text-xs", TYPE_COLORS[m.type])}>
                        {typeLabel(m.type)}
                      </Badge>
                      <p className="order-last w-full min-w-0 truncate sm:order-none sm:w-auto sm:flex-1">
                        {details}
                      </p>
                      {m.balanceAfter !== null && (
                        <span className="ml-auto shrink-0 tabular-nums">
                          {t("management.movementLog.balanceAfter").replace(
                            "{balance}",
                            `${Number(m.balanceAfter)} ${m.unit}`
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t("management.movementLog.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
