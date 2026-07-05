"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { ChartSkeleton } from "../components/chart-skeleton";

const RevenueTrendChart = dynamic(
  () => import("./revenue-trend-chart").then((mod) => ({ default: mod.RevenueTrendChart })),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const OrdersBreakdownChart = dynamic(
  () => import("./orders-breakdown-chart").then((mod) => ({ default: mod.OrdersBreakdownChart })),
  { loading: () => <ChartSkeleton />, ssr: false }
);

interface TopItem {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface OrdersAnalytics {
  totalOrders: number;
  revenue: number;
  aov: number;
  buckets: { date: string; orderCount: number; revenue: number }[];
  byStatus: { status: string; orderCount: number }[];
  byOrderType: { orderType: string; orderCount: number }[];
}

interface TopCustomer {
  name: string;
  phone: string;
  orderCount: number;
  totalSpend: number;
}

interface CustomersAnalytics {
  uniqueCustomers: number;
  anonymousOrders: number;
  newCustomers: number;
  returningCustomers: number;
  topCustomers: TopCustomer[];
}

interface AnalyticsSectionProps {
  storeId: string;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}

export function AnalyticsSection({ storeId }: AnalyticsSectionProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { advancedReportsAccess } = useFeatureAccess();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());

  const params = `from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
  const base = `/stores/${storeId}`;

  // Date-range analytics change slowly — a 5-min staleTime avoids re-scanning all
  // orders on every window refocus. (Revenue/order-count/trend come from the orders
  // endpoint, which already returns them — no separate finance/summary call needed.)
  const staleTime = 5 * 60 * 1000;

  const topItems = useQuery({
    queryKey: ["analytics-top-items", storeId, from, to],
    queryFn: () =>
      apiClient.get<{ items: TopItem[] }>(`${base}/finance/top-items?${params}&limit=5`),
    staleTime,
  });

  const orders = useQuery({
    queryKey: ["analytics-orders", storeId, from, to],
    queryFn: () => apiClient.get<OrdersAnalytics>(`${base}/orders/analytics?${params}`),
    staleTime,
  });

  const customers = useQuery({
    queryKey: ["analytics-customers", storeId, from, to],
    queryFn: () => apiClient.get<CustomersAnalytics>(`${base}/customers/analytics?${params}`),
    staleTime,
  });

  const isLoading = topItems.isLoading || orders.isLoading || customers.isLoading;
  const isEmpty = !isLoading && (orders.data?.totalOrders ?? 0) === 0;

  function exportXlsx() {
    const wb = XLSX.utils.book_new();

    if (orders.data && customers.data) {
      const rows = [
        [t("common.datePicker.from"), from],
        [t("common.datePicker.to"), to],
        [t("dashboard.analytics.revenue"), orders.data.revenue],
        [t("dashboard.analytics.orders"), orders.data.totalOrders],
        [t("dashboard.analytics.aov"), orders.data.aov],
        [t("dashboard.analytics.uniqueCustomers"), customers.data.uniqueCustomers],
        [t("dashboard.analytics.newCustomers"), customers.data.newCustomers],
        [t("dashboard.analytics.returningCustomers"), customers.data.returningCustomers],
        [t("dashboard.analytics.anonymousOrders"), customers.data.anonymousOrders],
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(rows),
        t("dashboard.analytics.title")
      );
    }

    if (orders.data) {
      const header = [t("common.name"), t("dashboard.analytics.orders")];
      const statusRows = orders.data.byStatus.map((s) => [s.status, s.orderCount]);
      const typeRows = orders.data.byOrderType.map((o) => [o.orderType, o.orderCount]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...statusRows, [], ...typeRows]),
        t("dashboard.analytics.ordersByStatus")
      );
    }

    if (customers.data?.topCustomers.length) {
      const header = [
        t("common.name"),
        t("common.phone"),
        t("dashboard.analytics.orders"),
        t("dashboard.analytics.revenue"),
      ];
      const rows = customers.data.topCustomers.map((c) => [
        c.name,
        c.phone,
        c.orderCount,
        c.totalSpend,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("dashboard.analytics.topCustomers")
      );
    }

    if (topItems.data?.items.length) {
      const header = [
        t("common.name"),
        t("dashboard.analytics.orders"),
        t("dashboard.analytics.revenue"),
      ];
      const rows = topItems.data.items.map((i) => [i.name, i.totalQuantity, i.totalRevenue]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([header, ...rows]),
        t("dashboard.analytics.topProducts")
      );
    }

    XLSX.writeFile(wb, `analytics-${from}-${to}.xlsx`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t("dashboard.analytics.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("dashboard.analytics.subtitle")}</p>
        </div>
        {advancedReportsAccess && (
          <Button size="sm" variant="outline" onClick={exportXlsx} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            {t("common.actions.exportAsExcel")}
          </Button>
        )}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="analytics-from">{t("common.datePicker.from")}</Label>
          <Input
            id="analytics-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="analytics-to">{t("common.datePicker.to")}</Label>
          <Input
            id="analytics-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-1">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-[280px] w-full" />
            <Skeleton className="h-[280px] w-full" />
          </div>
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {t("dashboard.analytics.noData")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("dashboard.analytics.revenue")}
              value={formatPrice(orders.data?.revenue ?? 0)}
              subtext={
                <>
                  {orders.data?.totalOrders ?? 0} {t("dashboard.analytics.orders")}
                </>
              }
            />
            <StatCard
              label={t("dashboard.analytics.orders")}
              value={orders.data?.totalOrders ?? 0}
            />
            <StatCard
              label={t("dashboard.analytics.aov")}
              value={formatPrice(orders.data?.aov ?? 0)}
            />
            <StatCard
              label={t("dashboard.analytics.uniqueCustomers")}
              value={customers.data?.uniqueCustomers ?? 0}
              subtext={
                <>
                  {customers.data?.newCustomers ?? 0} {t("dashboard.analytics.newCustomers")} ·{" "}
                  {customers.data?.returningCustomers ?? 0}{" "}
                  {t("dashboard.analytics.returningCustomers")}
                </>
              }
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("dashboard.analytics.revenueTrend")}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <RevenueTrendChart data={orders.data?.buckets ?? []} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("dashboard.analytics.ordersByStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <OrdersBreakdownChart data={orders.data?.byStatus ?? []} />
              </CardContent>
            </Card>
          </div>

          {/* Breakdown row */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("dashboard.analytics.topProducts")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(topItems.data?.items ?? []).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground mr-2">{i + 1}</span>
                      {item.name}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatPrice(item.totalRevenue)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("dashboard.analytics.topCustomers")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(customers.data?.topCustomers ?? []).map((c, i) => (
                  <div key={c.phone} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground mr-2">{i + 1}</span>
                      {c.name}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatPrice(c.totalSpend)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
