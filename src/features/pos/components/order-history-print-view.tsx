"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatDateTime } from "@/lib/utils/formatting";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { OrderHistoryItem } from "../types/pos.types";

interface StoreDetail {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
}

interface AccountDetail {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
}

interface AppliedFilters {
  status: string | null;
  source: string | null;
  from: string | null;
  to: string | null;
  q: string | null;
  unpaidOnly: boolean;
  productLabel: string | null;
  department: string | null;
  staffLabel: string | null;
}

interface OrderHistoryPrintViewProps {
  store: StoreDetail;
  account: AccountDetail;
  orders: OrderHistoryItem[];
  totalCount: number;
  truncated: boolean;
  filters: AppliedFilters;
  generatedAt: string;
}

function itemLine(item: OrderHistoryItem["items"][number]) {
  return `${Number(item.quantity)}x ${item.menuItem?.name ?? item.name}`;
}

export function OrderHistoryPrintView({
  store,
  account,
  orders,
  totalCount,
  truncated,
  filters,
  generatedAt,
}: OrderHistoryPrintViewProps) {
  const { t } = useI18n();
  // Order amounts are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  const mapStatusLabel = (s: string) => {
    const key = s === "IN_PRODUCTION" ? "inProduction" : s.toLowerCase();
    return t(`pos.status.${key}`);
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

  const filterChips: string[] = [];
  if (filters.status && filters.status !== "ALL") {
    filterChips.push(`${t("pos.history.colStatus")}: ${mapStatusLabel(filters.status)}`);
  }
  if (filters.source && filters.source !== "ALL") {
    filterChips.push(`${t("pos.history.colSource")}: ${filters.source}`);
  }
  if (filters.from || filters.to) {
    const fromLabel = filters.from ? formatDateTime(filters.from).split(",")[0] : "…";
    const toLabel = filters.to ? formatDateTime(filters.to).split(",")[0] : "…";
    filterChips.push(`${t("pos.printReport.filterDateRange")}: ${fromLabel} – ${toLabel}`);
  }
  if (filters.q) {
    filterChips.push(`${t("pos.printReport.filterSearch")}: "${filters.q}"`);
  }
  if (filters.unpaidOnly) {
    filterChips.push(t("pos.queue.unpaidOnly"));
  }
  if (filters.department === "KITCHEN" || filters.department === "BAR") {
    const label =
      filters.department === "KITCHEN" ? t("common.departmentKitchen") : t("common.departmentBar");
    filterChips.push(`${t("common.department")}: ${label}`);
  }
  if (filters.productLabel) {
    filterChips.push(`${t("pos.printReport.filterProduct")}: ${filters.productLabel}`);
  }
  if (filters.staffLabel) {
    filterChips.push(`${t("pos.printReport.filterStaff")}: ${filters.staffLabel}`);
  }

  const storeLocation = [store.city, store.country].filter(Boolean).join(", ");

  return (
    <div className="print-report min-h-screen bg-white text-black print:bg-white">
      {/* Diagonal watermark — repeats behind the content, very low opacity so it never
          interferes with reading the table. Fixed so it also appears on every printed page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden print:fixed"
      >
        <span
          className="text-8xl font-black whitespace-nowrap text-black/[0.04]"
          style={{ transform: "rotate(-30deg)" }}
        >
          {store.name} · {store.name} · {store.name}
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-8 py-8 print:px-0 print:py-0">
        {/* Non-printing toolbar */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <p className="text-sm text-gray-500">{t("pos.printReport.toolbarHint")}</p>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("pos.printReport.printAgain")}
          </Button>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <EpidomMark size={36} />
            <div>
              <p className="text-lg font-bold tracking-wide text-black">EPIDOM</p>
              <p className="text-sm text-gray-800">{t("pos.printReport.title")}</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-700">
            <p>{t("pos.printReport.generatedAt")}</p>
            <p className="font-medium text-black">{formatDateTime(generatedAt)}</p>
          </div>
        </div>

        {/* Store / account detail */}
        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-gray-700 uppercase">
              {t("pos.printReport.storeLabel")}
            </p>
            <p className="font-semibold text-black">{store.name}</p>
            {storeLocation && <p className="text-black">{storeLocation}</p>}
            {store.address && <p className="text-black">{store.address}</p>}
            {store.phone && <p className="text-black">{store.phone}</p>}
            {store.email && <p className="text-black">{store.email}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-gray-700 uppercase">
              {t("pos.printReport.accountLabel")}
            </p>
            <p className="font-semibold text-black">{account.businessName}</p>
            {account.ownerName && <p className="text-black">{account.ownerName}</p>}
            {account.ownerEmail && <p className="text-black">{account.ownerEmail}</p>}
          </div>
        </div>

        {/* Filters applied */}
        <div className="mb-6 rounded border border-gray-300 bg-gray-50 p-3 text-xs print:bg-gray-50">
          <p className="mb-1 font-semibold text-black">{t("pos.printReport.filtersApplied")}</p>
          <p className="text-gray-800">
            {filterChips.length > 0 ? filterChips.join("  ·  ") : t("pos.printReport.noFilters")}
          </p>
        </div>

        {/* Orders table */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2 font-semibold">{t("pos.history.colDate")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pos.history.colOrder")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pos.history.colType")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pos.history.colCustomer")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pos.history.colItems")}</th>
              <th className="py-2 pr-2 text-right font-semibold">{t("pos.history.colTotal")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pos.history.colPayment")}</th>
              <th className="py-2 pl-2 font-semibold">{t("pos.history.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(order.orderDate)}</td>
                <td className="py-1.5 pr-2 font-mono">{order.orderNumber}</td>
                <td className="py-1.5 pr-2">{mapTypeLabel(order.orderType)}</td>
                <td className="max-w-[120px] truncate py-1.5 pr-2">{order.customerName}</td>
                <td className="max-w-[220px] truncate py-1.5 pr-2">
                  {order.items.map(itemLine).join(", ")}
                </td>
                <td className="py-1.5 pr-2 text-right font-semibold whitespace-nowrap">
                  {formatPrice(Number(order.total))}
                </td>
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {mapPaymentLabel(order.paymentStatus)}
                </td>
                <td className="py-1.5 pl-2 whitespace-nowrap">{mapStatusLabel(order.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {orders.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-700">{t("pos.printReport.noOrders")}</p>
        )}

        {truncated && (
          <p className="mt-3 text-xs text-gray-700">
            {t("pos.printReport.rowCapNotice")
              .replace("{shown}", String(orders.length))
              .replace("{total}", String(totalCount))}
          </p>
        )}

        {/* Spacer so content doesn't sit under the fixed print footer */}
        <div className="h-16 print:block" />
      </div>

      {/* Repeating print footer */}
      <div className="hidden border-t border-gray-300 bg-white px-8 py-2 text-[10px] text-gray-800 print:fixed print:right-0 print:bottom-0 print:left-0 print:flex print:items-center print:justify-between">
        <span>
          {t("pos.printReport.systemBy")} · {store.name}
        </span>
        <span>{t("pos.printReport.poweredBy")}</span>
      </div>
    </div>
  );
}
