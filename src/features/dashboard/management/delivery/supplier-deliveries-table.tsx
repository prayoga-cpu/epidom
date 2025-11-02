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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useI18n } from "@/components/lang/i18n-provider";
import { SupplierDelivery, DeliveryType, SupplierDeliveryStatus } from "@/types/entities";
import { formatDate } from "@/lib/utils/formatting";
import {
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Trash2,
  X,
  Calendar,
  Printer,
  Truck,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  TruckIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SupplierDeliveriesTableProps {
  deliveries: SupplierDelivery[];
  selectedDelivery: SupplierDelivery | null;
  onDeliverySelect: (delivery: SupplierDelivery) => void;
  onEditDelivery?: (delivery: SupplierDelivery) => void;
  onUpdateStatus?: (delivery: SupplierDelivery) => void;
  onPrintDelivery?: (delivery: SupplierDelivery) => void;
  onDeleteDelivery?: (deliveryId: string) => void;
}

type SortField = "deliveryReference" | "supplierName" | "expectedDate" | "status" | "deliveryType";
type SortOrder = "asc" | "desc";

export function SupplierDeliveriesTable({
  deliveries,
  selectedDelivery,
  onDeliverySelect,
  onEditDelivery,
  onUpdateStatus,
  onPrintDelivery,
  onDeleteDelivery,
}: SupplierDeliveriesTableProps) {
  const { t } = useI18n();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("expectedDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Get status badge variant
  const getStatusVariant = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case SupplierDeliveryStatus.PENDING:
        return "secondary";
      case SupplierDeliveryStatus.IN_TRANSIT:
        return "default";
      case SupplierDeliveryStatus.RECEIVED:
        return "default";
      case SupplierDeliveryStatus.CANCELLED:
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Get status icon
  const getStatusIcon = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case SupplierDeliveryStatus.PENDING:
        return Clock;
      case SupplierDeliveryStatus.IN_TRANSIT:
        return TruckIcon;
      case SupplierDeliveryStatus.RECEIVED:
        return CheckCircle2;
      case SupplierDeliveryStatus.CANCELLED:
        return XCircle;
      default:
        return Clock;
    }
  };

  // Get delivery type badge variant
  const getTypeVariant = (type: DeliveryType) => {
    switch (type) {
      case DeliveryType.INCOMING:
        return "default";
      case DeliveryType.OUTGOING:
        return "secondary";
      default:
        return "secondary";
    }
  };

  // Get delivery type icon
  const getTypeIcon = (type: DeliveryType) => {
    return type === DeliveryType.INCOMING ? Package : Truck;
  };

  // Get status label
  const getStatusLabel = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case SupplierDeliveryStatus.PENDING:
        return t("management.delivery.status.pending") || "Pending";
      case SupplierDeliveryStatus.IN_TRANSIT:
        return t("management.delivery.status.inTransit") || "In Transit";
      case SupplierDeliveryStatus.RECEIVED:
        return t("management.delivery.status.received") || "Received";
      case SupplierDeliveryStatus.CANCELLED:
        return t("management.delivery.status.cancelled") || "Cancelled";
      default:
        return status;
    }
  };

  // Get delivery type label
  const getTypeLabel = (type: DeliveryType) => {
    switch (type) {
      case DeliveryType.INCOMING:
        return t("management.delivery.type.incoming") || "Incoming";
      case DeliveryType.OUTGOING:
        return t("management.delivery.type.outgoing") || "Outgoing";
      default:
        return type;
    }
  };

  // Filtered and sorted deliveries
  const processedDeliveries = useMemo(() => {
    let filtered = [...deliveries];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.deliveryReference.toLowerCase().includes(query) ||
          d.supplier?.name?.toLowerCase().includes(query) ||
          d.notes?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((d) => d.deliveryType === typeFilter);
    }

    // Date range filter (by expected date)
    if (dateRange) {
      filtered = filtered.filter((d) => {
        const expectedDate = new Date(d.expectedDate);
        if (dateRange.from && expectedDate < dateRange.from) return false;
        if (dateRange.to && expectedDate > dateRange.to) return false;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "deliveryReference":
          comparison = a.deliveryReference.localeCompare(b.deliveryReference);
          break;
        case "supplierName":
          comparison = a.supplier?.name?.localeCompare(b.supplier?.name || "") || 0;
          break;
        case "expectedDate":
          comparison = new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "deliveryType":
          comparison = a.deliveryType.localeCompare(b.deliveryType);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [deliveries, searchQuery, statusFilter, typeFilter, dateRange, sortField, sortOrder]);

  // Pagination
  const paginatedDeliveries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedDeliveries.slice(start, start + pageSize);
  }, [processedDeliveries, currentPage, pageSize]);

  const totalPages = Math.ceil(processedDeliveries.length / pageSize);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDateRange(undefined);
    setSortField("expectedDate");
    setSortOrder("desc");
  };

  // Handle date range change
  const handleDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setDateRange({ from: range.from, to: range.to });
    } else {
      setDateRange(undefined);
    }
  };

  const hasActiveFilters =
    searchQuery || statusFilter !== "all" || typeFilter !== "all" || dateRange !== undefined;

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden shadow-md transition-shadow hover:shadow-lg lg:col-span-2">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">
              {t("pages.supplierDeliveriesSectionTitle") || "Supplier Deliveries"} (
              {processedDeliveries.length})
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-6">
          {/* Filters */}
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("management.delivery.searchPlaceholder") || "Search by reference, supplier, or notes..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("management.delivery.filters.status") || "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("management.delivery.filters.allStatuses") || "All Statuses"}</SelectItem>
                  <SelectItem value="pending">{t("management.delivery.status.pending") || "Pending"}</SelectItem>
                  <SelectItem value="in_transit">{t("management.delivery.status.inTransit") || "In Transit"}</SelectItem>
                  <SelectItem value="received">{t("management.delivery.status.received") || "Received"}</SelectItem>
                  <SelectItem value="cancelled">{t("management.delivery.status.cancelled") || "Cancelled"}</SelectItem>
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Package className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("management.delivery.filters.deliveryType") || "Delivery Type"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("management.delivery.filters.allTypes") || "All Types"}</SelectItem>
                  <SelectItem value="incoming">{t("management.delivery.type.incoming") || "Incoming"}</SelectItem>
                  <SelectItem value="outgoing">{t("management.delivery.type.outgoing") || "Outgoing"}</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range */}
              <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  {t("common.actions.clearFilters") || "Clear Filters"}
                </Button>
              )}
            </div>
          </div>

          {/* Deliveries Table */}
          <div className="-mx-4 overflow-x-auto rounded-md border sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort("deliveryReference")}
                  >
                    <div className="flex items-center">
                      {t("management.delivery.table.reference") || "Reference"}
                      <SortIcon field="deliveryReference" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("supplierName")}>
                    <div className="flex items-center">
                      {t("management.delivery.table.supplier") || "Supplier"}
                      <SortIcon field="supplierName" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("deliveryType")}>
                    <div className="flex items-center">
                      {t("management.delivery.table.type") || "Type"}
                      <SortIcon field="deliveryType" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("expectedDate")}>
                    <div className="flex items-center">
                      {t("management.delivery.table.expectedDate") || "Expected Date"}
                      <SortIcon field="expectedDate" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                    <div className="flex items-center">
                      {t("management.delivery.table.status") || "Status"}
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">{t("management.delivery.table.items") || "Items"}</TableHead>
                  <TableHead className="text-right">{t("tables.actions") || "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                      {hasActiveFilters
                        ? (t("management.delivery.noMatches") || "No deliveries match your filters")
                        : (t("management.delivery.noDeliveries") || "No deliveries found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeliveries.map((delivery) => {
                    const StatusIcon = getStatusIcon(delivery.status);
                    const TypeIcon = getTypeIcon(delivery.deliveryType);

                    return (
                      <TableRow
                        key={delivery.id}
                        className={`cursor-pointer transition-colors ${
                          selectedDelivery?.id === delivery.id ? "bg-muted/50" : ""
                        }`}
                        onClick={() => onDeliverySelect(delivery)}
                      >
                        <TableCell className="font-medium">{delivery.deliveryReference}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{delivery.supplier?.name}</div>
                            <div className="text-muted-foreground text-xs">
                              {delivery.supplier?.contactPerson}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeVariant(delivery.deliveryType)} className="gap-1">
                            <TypeIcon className="h-3 w-3" />
                            {getTypeLabel(delivery.deliveryType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="text-muted-foreground h-3 w-3" />
                            <span className="text-sm">{formatDate(delivery.expectedDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(delivery.status)} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {getStatusLabel(delivery.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {delivery.items.length} {delivery.items.length !== 1 ? t("management.delivery.items") : t("management.delivery.item")}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => onDeliverySelect(delivery)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("management.delivery.actions.viewDelivery")}</TooltipContent>
                            </Tooltip>
                            {onEditDelivery && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => onEditDelivery(delivery)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t("management.delivery.actions.editDelivery")}</TooltipContent>
                              </Tooltip>
                            )}
                            {onPrintDelivery && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => onPrintDelivery(delivery)}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t("management.delivery.actions.printDelivery")}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">{t("common.pagination.rowsPerPage")}:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[80px]">
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

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("common.pagination.page")} {currentPage} {t("common.of")} {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    {t("common.actions.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {t("common.actions.next")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
