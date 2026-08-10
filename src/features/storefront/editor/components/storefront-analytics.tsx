"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { apiClient } from "@/lib/api/client";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { DateRangeField } from "@/components/ui/date-range-field";
import { todayLocalISO } from "@/lib/utils/date-range";

const VisitorTrendChart = dynamic(
  () => import("./visitor-trend-chart").then((mod) => ({ default: mod.VisitorTrendChart })),
  { loading: () => <Skeleton className="h-full w-full" />, ssr: false }
);

interface StorefrontAnalyticsData {
  uniqueVisitors: number;
  visitorTrend: number;
  pageViews: number;
  menuViews: number;
  menuViewRate: number;
  whatsappClicks: number;
  chatConversionRate: number;
  storefrontOrders: number;
  storefrontRevenue: number;
  orderConversionRate: number;
  dailyBuckets: { date: string; uniqueVisitors: number; orders: number }[];
  topViewedItems: { menuItemId: string; menuItemName: string; viewCount: number }[];
}

interface TopOrderedItem {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface StorefrontAnalyticsProps {
  storeId: string;
}

export function StorefrontAnalytics({ storeId }: StorefrontAnalyticsProps) {
  const { t } = useI18n();
  // Every revenue figure here (storefrontRevenue, totalRevenue) is Order-derived
  // — already literal in the owner's own currency, not IDR. Bare formatPrice()
  // would wrongly re-scale it by the exchange rate for a non-IDR store.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const [from, setFrom] = useState(todayLocalISO());
  const [to, setTo] = useState(todayLocalISO());

  const params = `from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
  const staleTime = 5 * 60 * 1000;

  const analytics = useQuery({
    queryKey: ["storefront-analytics", storeId, from, to],
    queryFn: () =>
      apiClient.get<StorefrontAnalyticsData>(
        `/stores/${storeId}/storefront/analytics?${params}`
      ),
    staleTime,
  });

  const topOrdered = useQuery({
    queryKey: ["storefront-analytics-top-ordered", storeId, from, to],
    queryFn: () =>
      apiClient.get<{ items: TopOrderedItem[] }>(
        `/stores/${storeId}/finance/top-items?${params}&channel=STOREFRONT&limit=5`
      ),
    staleTime,
  });

  const data = analytics.data;
  const isLoading = analytics.isLoading;
  const isEmpty = !isLoading && (data?.uniqueVisitors ?? 0) === 0 && (data?.pageViews ?? 0) === 0;

  const trendLabel = (trend: number) => {
    const sign = trend > 0 ? "+" : "";
    return `${sign}${trend}% ${t("storefront.analytics.trendVsPreviousPeriod")}`;
  };

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="storefront-analytics-date-range">
            {t("common.datePicker.dateRange")}
          </Label>
          <DateRangeField
            id="storefront-analytics-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {t("storefront.analytics.dataCollecting")}
            <p className="mt-1 text-xs">{t("storefront.analytics.dataCollectingDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={t("storefront.analytics.totalVisitors")}
              value={(data?.uniqueVisitors ?? 0).toLocaleString()}
              subtext={trendLabel(data?.visitorTrend ?? 0)}
            />
            <StatCard
              label={t("storefront.analytics.menuViewed")}
              value={(data?.menuViews ?? 0).toLocaleString()}
              subtext={`${data?.menuViewRate ?? 0}% ${t("storefront.analytics.ofVisitors")}`}
            />
            <StatCard
              label={t("storefront.analytics.chatConversion")}
              value={(data?.whatsappClicks ?? 0).toLocaleString()}
              subtext={`${data?.chatConversionRate ?? 0}% ${t("storefront.analytics.ofVisitors")}`}
            />
            <StatCard
              label={t("storefront.analytics.storefrontOrders")}
              value={(data?.storefrontOrders ?? 0).toLocaleString()}
              subtext={`${data?.orderConversionRate ?? 0}% ${t("storefront.analytics.conversionRate")}`}
            />
            <StatCard
              label={t("storefront.analytics.storefrontRevenue")}
              value={formatPrice(data?.storefrontRevenue ?? 0)}
            />
            <StatCard
              label={t("storefront.analytics.pageViews")}
              value={(data?.pageViews ?? 0).toLocaleString()}
            />
          </div>

          {/* Visitor chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t("storefront.analytics.visitorChart")}</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <VisitorTrendChart data={data?.dailyBuckets ?? []} />
            </CardContent>
          </Card>

          {/* Breakdown row */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("storefront.analytics.topViewedItems")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.topViewedItems.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("storefront.analytics.noData")}
                  </p>
                ) : (
                  data?.topViewedItems.map((item, i) => (
                    <div
                      key={item.menuItemId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground mr-2">{i + 1}</span>
                        {item.menuItemName}
                      </span>
                      <span className="font-semibold whitespace-nowrap">
                        {item.viewCount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("storefront.analytics.topOrderedItems")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(topOrdered.data?.items.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("storefront.analytics.noData")}
                  </p>
                ) : (
                  topOrdered.data?.items.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground mr-2">{i + 1}</span>
                        {item.name}
                      </span>
                      <span className="font-semibold whitespace-nowrap">
                        {formatPrice(item.totalRevenue)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
