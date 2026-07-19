"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatDateTime } from "@/lib/utils/formatting";
import { apiClient } from "@/lib/api/client";
import { AGGREGATOR_LABELS } from "@/config/aggregator.config";
import {
  buildOrderHistoryParams,
  useDebouncedValue,
  useOrderHistory,
} from "../hooks/use-order-history";
import type { OrderHistoryFilters, OrderHistoryItem, OrderHistoryPage } from "../types/pos.types";
import { OrderHistoryDetailDialog } from "./order-history-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "DELIVERED",
  "CANCELLED",
  "HELD",
] as const;

const EXPORT_ROW_CAP = 5000;

function getSourceBadgeVariant(source: string) {
  switch (source) {
    case "POS":
      return "default";
    case "STOREFRONT":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "CONFIRMED":
      return "default";
    case "IN_PRODUCTION":
      return "outline";
    case "READY":
      return "default";
    case "DELIVERED":
      return "default";
    case "CANCELLED":
      return "destructive";
    case "HELD":
      return "secondary";
    default:
      return "outline";
  }
}

function getPaymentBadgeVariant(paymentStatus: string) {
  switch (paymentStatus) {
    case "PAID":
      return "default";
    case "PENDING":
      return "secondary";
    case "FAILED":
      return "destructive";
    case "EXPIRED":
      return "destructive";
    default:
      return "outline";
  }
}

function itemLine(item: OrderHistoryItem["items"][number]) {
  return `${Number(item.quantity)}x ${item.menuItem?.name ?? item.name}`;
}

interface OrderHistoryTabProps {
  storeId: string;
}

export function OrderHistoryTab({ storeId }: OrderHistoryTabProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<OrderHistoryItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);
  const filters: OrderHistoryFilters = { q: debouncedSearch, status, source, from, to };

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useOrderHistory(
    storeId,
    filters
  );

  const orders = data?.pages.flatMap((p) => p.orders) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  const mapStatusLabel = (s: string) => {
    const key = s === "IN_PRODUCTION" ? "inProduction" : s.toLowerCase();
    return t(`pos.status.${key}`);
  };

  const mapSourceLabel = (s: string) => {
    switch (s) {
      case "MANUAL":
        return t("pos.history.sourceManual");
      case "STOREFRONT":
        return t("pos.history.sourceStorefront");
      case "POS":
        return t("pos.history.sourcePos");
      default:
        return AGGREGATOR_LABELS[s as keyof typeof AGGREGATOR_LABELS] ?? s;
    }
  };

  const mapPaymentLabel = (s: string) => {
    switch (s) {
      case "PAID":
        return t("pos.history.paymentPaid");
      case "PENDING":
        return t("pos.history.paymentPending");
      case "FAILED":
        return t("pos.history.paymentFailed");
      case "EXPIRED":
        return t("pos.history.paymentExpired");
      case "REFUNDED":
        return t("pos.history.paymentRefunded");
      default:
        return s;
    }
  };

  const mapTypeLabel = (orderType: string) => {
    switch (orderType) {
      case "DINE_IN":
        return t("pos.checkout.dineIn");
      case "TAKEAWAY":
        return t("pos.checkout.takeaway");
      default:
        return t("pos.history.delivery");
    }
  };

  async function exportXlsx() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const all: OrderHistoryItem[] = [];
      let cursor: string | null = null;
      do {
        const params = buildOrderHistoryParams(filters, 100, cursor);
        const page = await apiClient.get<OrderHistoryPage>(
          `/stores/${storeId}/orders?${params.toString()}`
        );
        all.push(...page.orders);
        cursor = page.nextCursor;
      } while (cursor && all.length < EXPORT_ROW_CAP);

      if (all.length === 0) {
        toast.info(t("messages.noDataToExport"));
        return;
      }

      const wb = XLSX.utils.book_new();
      const header = [
        t("pos.history.colDate"),
        t("pos.history.colOrder"),
        t("pos.history.colSource"),
        t("pos.history.colType"),
        t("pos.history.colCustomer"),
        t("common.phone"),
        t("pos.history.colItems"),
        t("pos.cart.subtotal"),
        t("pos.cart.tax"),
        t("pos.history.delivery"),
        t("pos.history.colTotal"),
        t("pos.checkout.paymentMethod"),
        t("pos.history.colPayment"),
        t("pos.history.colStatus"),
        t("pos.history.detailNotes"),
      ];
      const rows = all
        .slice(0, EXPORT_ROW_CAP)
        .map((o) => [
          formatDateTime(o.orderDate),
          o.orderNumber,
          o.source,
          o.orderType,
          o.customerName,
          o.customerPhone ?? "",
          o.items.map(itemLine).join(", "),
          Number(o.subtotal),
          Number(o.tax),
          Number(o.delivery),
          Number(o.total),
          o.paymentMethod,
          o.paymentStatus,
          o.status,
          o.notes ?? "",
        ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Orders");
      XLSX.writeFile(wb, `orders-history-${filters.from || "all"}-${filters.to || "all"}.xlsx`);
    } catch {
      toast.error(t("messages.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder={t("pos.history.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("pos.history.allStatuses")}</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {mapStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("pos.history.allSources")}</SelectItem>
            <SelectItem value="MANUAL">{t("pos.history.sourceManual")}</SelectItem>
            <SelectItem value="STOREFRONT">{t("pos.history.sourceStorefront")}</SelectItem>
            <SelectItem value="POS">{t("pos.history.sourcePos")}</SelectItem>
            {Object.entries(AGGREGATOR_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-3">
          <div className="space-y-1">
            <Label htmlFor="history-from" className="text-xs">
              {t("pos.history.from")}
            </Label>
            <Input
              id="history-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-to" className="text-xs">
              {t("pos.history.to")}
            </Label>
            <Input
              id="history-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36"
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportXlsx}
          disabled={isExporting}
          className="shrink-0"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t("common.actions.exportAsExcel")}
        </Button>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <h3 className="mb-1 font-semibold">{t("pos.history.empty")}</h3>
          <p className="text-muted-foreground text-sm">{t("pos.history.emptyDesc")}</p>
        </div>
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[960px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pos.history.colDate")}</TableHead>
                    <TableHead>{t("pos.history.colOrder")}</TableHead>
                    <TableHead>{t("pos.history.colSource")}</TableHead>
                    <TableHead>{t("pos.history.colType")}</TableHead>
                    <TableHead>{t("pos.history.colCustomer")}</TableHead>
                    <TableHead>{t("pos.history.colItems")}</TableHead>
                    <TableHead className="text-right">{t("pos.history.colTotal")}</TableHead>
                    <TableHead>{t("pos.history.colPayment")}</TableHead>
                    <TableHead>{t("pos.history.colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(order)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(order.orderDate)}
                      </TableCell>
                      <TableCell className="font-mono">{order.orderNumber}</TableCell>
                      <TableCell>
                        <Badge variant={getSourceBadgeVariant(order.source)}>
                          {mapSourceLabel(order.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>{mapTypeLabel(order.orderType)}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{order.customerName}</TableCell>
                      <TableCell className="max-w-64 truncate">
                        {order.items.slice(0, 2).map(itemLine).join(", ")}
                        {order.items.length > 2 && (
                          <span className="text-muted-foreground">
                            {" "}
                            {t("pos.history.moreItems").replace(
                              "{n}",
                              String(order.items.length - 2)
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPrice(Number(order.total))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                          {mapPaymentLabel(order.paymentStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {mapStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("pos.history.results").replace("{n}", String(totalCount))}
            </p>
            {hasNextPage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("pos.history.loadMore")}
              </Button>
            )}
          </div>
        </>
      )}

      <OrderHistoryDetailDialog
        order={selected}
        storeId={storeId}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
