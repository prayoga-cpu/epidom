"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Info } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatCurrency } from "@/lib/utils/formatting";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeField } from "@/components/ui/date-range-field";
import { startOfMonthLocalISO, todayLocalISO } from "@/lib/utils/date-range";
import { useSortable, sortRows } from "@/features/dashboard/shared/hooks/use-sortable";
import { SortableHead, ReportStatus, ReportStatusRow } from "./finance-report-parts";

/** One outlet's row of GET /api/owner/summary. */
export interface OutletMetric {
  storeId: string;
  name: string;
  image: string | null;
  /** This outlet's own currency — every money figure in the row is in it. */
  currency: string;
  revenue: number;
  orderCount: number;
  pendingOrders: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  wasteLoss: number;
  netProfit: number;
}

export interface AllOutletsTotals {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  wasteLoss: number;
  netProfit: number;
}

export interface AllOutletsSummary {
  from: string;
  to: string;
  businessName: string;
  storeCount: number;
  totalOrders: number;
  totalPending: number;
  /** The one currency every outlet uses, or null when they differ. */
  currency: string | null;
  mixedCurrencies: boolean;
  currencies: string[];
  /** Money totals — null when outlets use different currencies, since
   * rupiah and euros can't be added into one meaningful number. */
  totals: AllOutletsTotals | null;
  stores: OutletMetric[];
}

type SortField =
  | "name"
  | "revenue"
  | "cogs"
  | "grossProfit"
  | "grossMarginPct"
  | "wasteLoss"
  | "netProfit"
  | "orderCount";

interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  tone?: "loss";
}

const isDateOnly = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

interface AllOutletsReportProps {
  scopeSwitch: ReactNode;
}

/**
 * Finance's "All outlets" scope: every store in the business side by side,
 * for the same date range. It used to be a separate Owner dashboard; it lives
 * here now so the roll-up and the per-outlet report are one place, one date
 * range, one set of definitions.
 */
export function AllOutletsReport({ scopeSwitch }: AllOutletsReportProps) {
  const { t, intlLocale } = useI18n();
  // Each outlet's figures arrive already in that outlet's own currency
  // (revenue straight from Order.total, costs converted server-side), so they
  // are formatted as-is in it — never through useCurrency().formatPrice, which
  // would re-convert from IDR and label everything with THIS store's currency.
  const money = (value: number, currency: string) => formatCurrency(value, currency, intlLocale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Shares the single-outlet report's from/to URL params so switching scope
  // keeps the period. A till-session selection there stores full ISO
  // datetimes, which this picker can't show — fall back to month-to-date
  // rather than feed the date field a value it would mangle.
  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");
  const hasDateRange = isDateOnly(initialFrom) && isDateOnly(initialTo);
  const [from, setFrom] = useState(hasDateRange ? initialFrom : startOfMonthLocalISO());
  const [to, setTo] = useState(hasDateRange ? initialTo : todayLocalISO());

  const syncDates = useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", nextFrom);
      params.set("to", nextTo);
      // A shift selection belongs to one outlet; it means nothing here.
      params.delete("shiftId");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Same whole-UTC-day widening the single-outlet report uses, so an
  // outlet's row here matches its own Finance page for the same dates.
  const rangeParams = `from=${encodeURIComponent(`${from}T00:00:00Z`)}&to=${encodeURIComponent(
    `${to}T23:59:59Z`
  )}`;

  const summary = useQuery({
    queryKey: ["owner-summary", from, to],
    queryFn: () => apiClient.get<AllOutletsSummary>(`/owner/summary?${rangeParams}`),
    retry: false,
  });

  const sort = useSortable<SortField>("revenue");
  const sortedOutlets = useMemo(() => {
    const data = summary.data;
    const sorted = sortRows(data?.stores ?? [], sort.sortDir, (row) =>
      sort.sortField === "name" ? row.name : row[sort.sortField]
    );
    // Rupiah and euros can't be ranked against each other any more than
    // they can be added: with mixed currencies, group outlets by currency and
    // sort within each group.
    return data?.mixedCurrencies
      ? data.currencies.flatMap((currency) => sorted.filter((o) => o.currency === currency))
      : sorted;
  }, [summary.data, sort.sortField, sort.sortDir]);

  const s = summary.data;

  async function exportXlsx() {
    if (!s) return;
    const XLSX = await import("xlsx");
    const header = [
      t("pages.financeOutlet"),
      t("pages.financeCurrency"),
      t("pages.financeRevenue"),
      t("pages.financeCogs"),
      t("pages.financeGrossProfit"),
      t("pages.financeMargin"),
      t("pages.financeWasteLoss"),
      t("pages.financeNetProfit"),
      t("pages.financeOrders"),
      t("pages.financeAwaitingPayment"),
    ];
    const rows: Array<Array<string | number>> = sortedOutlets.map((o) => [
      o.name,
      o.currency,
      o.revenue,
      o.cogs,
      o.grossProfit,
      o.grossMarginPct,
      o.wasteLoss,
      o.netProfit,
      o.orderCount,
      o.pendingOrders,
    ]);
    // No money total for a mixed-currency business — same rule as on screen.
    if (s.totals) {
      rows.push([
        t("pages.financeTotal"),
        s.currency ?? "",
        s.totals.revenue,
        s.totals.cogs,
        s.totals.grossProfit,
        s.totals.grossMarginPct,
        s.totals.wasteLoss,
        s.totals.netProfit,
        s.totalOrders,
        s.totalPending,
      ]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([[t("pages.financePeriod"), `${from} — ${to}`], [], header, ...rows]),
      t("pages.financeByOutlet")
    );
    XLSX.writeFile(wb, `finance-all-outlets-${from}-${to}.xlsx`);
  }

  // Counts always add up across outlets; money only when they share a currency.
  const moneyKpis: KpiCard[] =
    s?.totals && s.currency
      ? [
          {
            label: t("pages.financeRevenue"),
            value: money(s.totals.revenue, s.currency),
            sub: `${s.totalOrders} ${t("pages.financeOrders")}`,
          },
          {
            label: t("pages.financeGrossProfit"),
            value: money(s.totals.grossProfit, s.currency),
            sub: `${s.totals.grossMarginPct.toFixed(1)}% ${t("pages.financeMargin")}`,
          },
          {
            label: t("pages.financeWasteLoss"),
            value: money(s.totals.wasteLoss, s.currency),
            tone: "loss",
          },
          { label: t("pages.financeNetProfit"), value: money(s.totals.netProfit, s.currency) },
        ]
      : [];
  const kpis: KpiCard[] = s
    ? [
        ...moneyKpis,
        ...(s.totals ? [] : [{ label: t("pages.financeOrders"), value: String(s.totalOrders) }]),
        { label: t("pages.financeOutletCount"), value: String(s.storeCount) },
        {
          label: t("pages.financeAwaitingPayment"),
          value: String(s.totalPending),
          sub: t("pages.financeAwaitingPaymentHint"),
        },
      ]
    : [];

  return (
    <div className="min-h-[calc((100vh-150px)/var(--app-zoom,1))] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pages.financeTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pages.financeAllOutletsDesc")}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {scopeSwitch}
          <Button size="sm" variant="outline" className="h-10" onClick={exportXlsx} disabled={!s}>
            <Download className="mr-2 h-4 w-4" />
            {t("common.actions.exportAsExcel")}
          </Button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="finance-all-outlets-date-range">{t("common.datePicker.dateRange")}</Label>
          <DateRangeField
            id="finance-all-outlets-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
              syncDates(nextFrom, nextTo);
            }}
          />
        </div>
      </div>

      {s?.mixedCurrencies && (
        <div className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {t("pages.financeMixedCurrencies").replace("{currencies}", s.currencies.join(", "))}
          </p>
        </div>
      )}

      {/* KPI cards */}
      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      ) : summary.isError ? (
        <div className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
          <ReportStatus
            isError
            onRetry={() => summary.refetch()}
            loadingLabel=""
            errorLabel={t("pages.financeLoadError")}
            retryLabel={t("common.actions.retry")}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${kpi.tone === "loss" ? "text-red-600" : ""}`}>
                  {kpi.value}
                </p>
                {kpi.sub && <p className="text-muted-foreground text-xs">{kpi.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* By outlet */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-semibold">{t("pages.financeByOutlet")}</CardTitle>
          <p className="text-muted-foreground text-xs">{t("pages.financeByOutletHint")}</p>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[860px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      active={sort.sortField === "name"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggleSort("name")}
                    >
                      {t("pages.financeOutlet")}
                    </SortableHead>
                    {(
                      [
                        ["revenue", "pages.financeRevenue"],
                        ["cogs", "pages.financeCogs"],
                        ["grossProfit", "pages.financeGrossProfit"],
                        ["grossMarginPct", "pages.financeMargin"],
                        ["wasteLoss", "pages.financeWasteLoss"],
                        ["netProfit", "pages.financeNetProfit"],
                        ["orderCount", "pages.financeOrders"],
                      ] as const
                    ).map(([field, labelKey]) => (
                      <SortableHead
                        key={field}
                        align="right"
                        active={sort.sortField === field}
                        dir={sort.sortDir}
                        onClick={() => sort.toggleSort(field)}
                      >
                        {t(labelKey)}
                      </SortableHead>
                    ))}
                    <TableHead className="text-right">
                      {t("pages.financeAwaitingPayment")}
                    </TableHead>
                    <TableHead className="w-11">
                      <span className="sr-only">{t("pages.financeOpenOutletReport")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.isLoading || summary.isError ? (
                    <ReportStatusRow
                      isError={summary.isError}
                      colSpan={10}
                      onRetry={() => summary.refetch()}
                      loadingLabel={t("common.loading")}
                      errorLabel={t("pages.financeLoadError")}
                      retryLabel={t("common.actions.retry")}
                    />
                  ) : (
                    sortedOutlets.map((outlet) => (
                      <TableRow key={outlet.storeId}>
                        <TableCell className="font-medium">{outlet.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(outlet.revenue, outlet.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(outlet.cogs, outlet.currency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {money(outlet.grossProfit, outlet.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {outlet.grossMarginPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-red-600 tabular-nums">
                          {money(outlet.wasteLoss, outlet.currency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {money(outlet.netProfit, outlet.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {outlet.orderCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {outlet.pendingOrders > 0 ? (
                            <Badge variant="outline" className="text-orange-600">
                              {outlet.pendingOrders}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        {/* Into that outlet's own report, same period — the
                            roll-up answers "which outlet", this answers "why". */}
                        <TableCell className="p-0 text-right">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`${t("pages.financeOpenOutletReport")} — ${outlet.name}`}
                          >
                            <Link href={`/store/${outlet.storeId}/finance?from=${from}&to=${to}`}>
                              <ArrowRight className="size-4" aria-hidden />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {s?.totals && s.currency && s.stores.length > 1 && (
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell>{t("pages.financeTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.totals.revenue, s.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.totals.cogs, s.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.totals.grossProfit, s.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.totals.grossMarginPct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right text-red-600 tabular-nums">
                        {money(s.totals.wasteLoss, s.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.totals.netProfit, s.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.totalOrders}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.totalPending}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
