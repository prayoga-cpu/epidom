"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api/client";
import { useCurrency } from "@/components/providers/currency-provider";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Store, TrendingUp, ShoppingCart, Clock, Percent } from "lucide-react";

interface StoreMetric {
  storeId: string;
  name: string;
  image: string | null;
  revenue: number;
  orderCount: number;
  pendingOrders: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  wasteLoss: number;
  netProfit: number;
}

interface OwnerSummary {
  from: string;
  to: string;
  businessName: string;
  totalRevenue: number;
  totalOrders: number;
  totalPending: number;
  totalCogs: number;
  totalGrossProfit: number;
  totalGrossMarginPct: number;
  totalWasteLoss: number;
  totalNetProfit: number;
  storeCount: number;
  stores: StoreMetric[];
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}

export function OwnerDashboardClient() {
  const { t } = useI18n();
  // Every figure from /api/owner/summary (revenue, cogs, grossProfit,
  // wasteLoss, netProfit) is already literal in the owner's own currency —
  // revenue directly from Order.total, and cogs/wasteLoss pre-converted
  // server-side (see storefront.service.ts's convertBaseToOwnerSync) before
  // being combined with it. Bare formatPrice() defaults to converting from
  // IDR, which would wrongly re-scale these for any non-IDR business.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());

  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-summary", from, to],
    queryFn: () =>
      apiClient.get<OwnerSummary>(`/api/owner/summary?from=${from}T00:00:00Z&to=${to}T23:59:59Z`),
    retry: false,
  });

  const isEnterpriseLocked = (error as any)?.status === 403;

  return (
    <div className="min-h-[calc((100vh-64px)/var(--app-zoom,1))] space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("pages.ownerTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("pages.ownerDesc")}</p>
      </div>

      {isEnterpriseLocked && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="pt-6">
            <p className="font-medium text-orange-700 dark:text-orange-300">
              {t("pages.enterpriseRequired")}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{t("pages.upgradeToEnterprise")}</p>
          </CardContent>
        </Card>
      )}

      {/* Date range */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="owner-date-range">{t("common.datePicker.dateRange")}</Label>
          <DateRangeField
            id="owner-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
        </div>
      </div>

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("pages.ownerTotalRevenue")}
                </CardTitle>
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(data.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("pages.financeGrossProfit")}
                </CardTitle>
                <Percent className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(data.totalGrossProfit)}</p>
                <p className="text-muted-foreground text-xs">{data.totalGrossMarginPct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("pages.ownerTotalOrders")}
                </CardTitle>
                <ShoppingCart className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("pages.ownerPendingOrders")}
                </CardTitle>
                <Clock className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totalPending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t("pages.ownerStoreCount")}
                </CardTitle>
                <Store className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.storeCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-store table — drill-down to the full accuracy /finance
              page for any one store lives via its own nav, this is the
              cross-store overview. */}
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[680px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCogs")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeGrossProfit")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeMargin")}</TableHead>
                    <TableHead className="text-right">{t("pages.ownerOrders")}</TableHead>
                    <TableHead className="text-right">{t("pages.ownerPending")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.stores.map((store) => (
                      <TableRow key={store.storeId}>
                        <TableCell className="font-medium">{store.name}</TableCell>
                        <TableCell className="text-right">{formatPrice(store.revenue)}</TableCell>
                        <TableCell className="text-right">{formatPrice(store.cogs)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(store.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">{store.grossMarginPct}%</TableCell>
                        <TableCell className="text-right">{store.orderCount}</TableCell>
                        <TableCell className="text-right">
                          {store.pendingOrders > 0 ? (
                            <Badge variant="outline" className="text-orange-600">
                              {store.pendingOrders}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
