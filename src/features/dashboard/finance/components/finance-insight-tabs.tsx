"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { averageTicket, sharePct, sumColumns } from "@/lib/finance/report-totals";
import { ReportStatus } from "./finance-report-parts";
import {
  adjustmentsQuery,
  labourQuery,
  salesPatternsQuery,
  taxQuery,
  type FinanceQueryScope,
} from "../finance-queries";
import type { OrderType, PayType, SummaryData } from "../finance-types";

type FormatMoney = (value: number | null | undefined) => string;

interface InsightTabProps {
  scope: FinanceQueryScope;
  formatMoney: FormatMoney;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
        {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

/** A tab's loading / error state, shared by the four tabs below. */
function TabState({
  isLoading,
  isError,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
      <ReportStatus
        isError={isError}
        onRetry={onRetry}
        loadingLabel=""
        errorLabel={t("pages.financeLoadError")}
        retryLabel={t("common.actions.retry")}
      />
    </div>
  );
}

/** A table that scrolls sideways on a phone instead of crushing its figures. */
function ScrollTable({ minWidth, children }: { minWidth: number; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div style={{ minWidth }}>
        <Table>{children}</Table>
      </div>
    </div>
  );
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  DINE_IN: "publicOrder.dineIn",
  TAKEAWAY: "publicOrder.takeaway",
  DELIVERY: "publicOrder.delivery",
};

// ─── Sales patterns ───

/** Mon…Sun in the viewer's language. 1 Jan 2024 was a Monday. */
function useWeekdayNames(): string[] {
  const { intlLocale } = useI18n();
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }, [intlLocale]);
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function SalesPatternsTab({ scope, formatMoney }: InsightTabProps) {
  const { t } = useI18n();
  const query = useQuery(salesPatternsQuery(scope));
  const weekdays = useWeekdayNames();
  const data = query.data;

  if (!data) {
    return (
      <TabState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
      />
    );
  }

  const typeTotals = sumColumns(data.byOrderType, ["orderCount", "revenue", "guests"] as const);
  const busiestHour = [...data.byHour].sort((a, b) => b.revenue - a.revenue)[0];
  const busiestDay = [...data.byWeekday].sort((a, b) => b.revenue - a.revenue)[0];
  const traded = data.byHour.filter((h) => h.orderCount > 0);
  const firstHour = traded.length ? traded[0].hour : 8;
  const lastHour = traded.length ? traded[traded.length - 1].hour : 20;
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const cellMap = new Map(data.cells.map((c) => [`${c.weekday}:${c.hour}`, c]));
  const maxCellRevenue = Math.max(0, ...data.cells.map((c) => c.revenue));
  const { guests, ordersWithGuests, revenueWithGuests } = data.covers;

  if (typeTotals.orderCount === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">{t("pages.noData")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("pages.financeBusiestHour")}
          value={
            busiestHour
              ? `${hourLabel(busiestHour.hour)}–${hourLabel((busiestHour.hour + 1) % 24)}`
              : "—"
          }
          sub={
            busiestHour &&
            `${formatMoney(busiestHour.revenue)} · ${busiestHour.orderCount} ${t("pages.financeOrders")}`
          }
        />
        <StatCard
          label={t("pages.financeBusiestDay")}
          value={busiestDay ? weekdays[busiestDay.weekday] : "—"}
          sub={
            busiestDay &&
            `${formatMoney(busiestDay.revenue)} · ${busiestDay.orderCount} ${t("pages.financeOrders")}`
          }
        />
        <StatCard
          label={t("pages.financeRevenuePerGuest")}
          value={guests > 0 ? formatMoney(averageTicket(revenueWithGuests, guests)) : "—"}
          sub={
            guests > 0
              ? t("pages.financeGuestsSub")
                  .replace("{guests}", String(guests))
                  .replace("{size}", (guests / Math.max(ordersWithGuests, 1)).toFixed(1))
              : t("pages.financeNoGuestCounts")
          }
        />
      </div>

      <div className="space-y-2">
        <SectionTitle>{t("pages.financeByOrderType")}</SectionTitle>
        <ScrollTable minWidth={560}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pages.financeOrderType")}</TableHead>
              <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
              <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
              <TableHead className="text-right">{t("pages.financeShare")}</TableHead>
              <TableHead className="text-right">{t("pages.financeAvgTicket")}</TableHead>
              <TableHead className="text-right">{t("pages.financeGuests")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byOrderType.map((row) => (
              <TableRow key={row.orderType}>
                <TableCell className="font-medium">{t(ORDER_TYPE_LABEL[row.orderType])}</TableCell>
                <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(row.revenue)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {sharePct(row.revenue, typeTotals.revenue)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(averageTicket(row.revenue, row.orderCount))}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.guests || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>{t("pages.financeTotal")}</TableCell>
              <TableCell className="text-right tabular-nums">{typeTotals.orderCount}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(typeTotals.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums">100%</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(averageTicket(typeTotals.revenue, typeTotals.orderCount))}
              </TableCell>
              <TableCell className="text-right tabular-nums">{typeTotals.guests || "—"}</TableCell>
            </TableRow>
          </TableFooter>
        </ScrollTable>
      </div>

      <div className="space-y-2">
        <SectionTitle>{t("pages.financeSalesHeatmap")}</SectionTitle>
        <p className="text-muted-foreground text-xs">
          {t("pages.financeSalesHeatmapHint").replace("{timezone}", data.timezone)}
        </p>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th />
                {hours.map((hour) => (
                  <th
                    key={hour}
                    className="text-muted-foreground w-9 px-0.5 font-normal tabular-nums"
                  >
                    {String(hour).padStart(2, "0")}
                  </th>
                ))}
                <th className="text-muted-foreground pl-2 text-right font-normal">
                  {t("pages.financeRevenue")}
                </th>
              </tr>
            </thead>
            <tbody>
              {weekdays.map((name, weekday) => (
                <tr key={weekday}>
                  <th className="text-muted-foreground pr-2 text-left font-normal whitespace-nowrap">
                    {name}
                  </th>
                  {hours.map((hour) => {
                    const cell = cellMap.get(`${weekday}:${hour}`);
                    const strength = cell && maxCellRevenue > 0 ? cell.revenue / maxCellRevenue : 0;
                    return (
                      <td
                        key={hour}
                        className="bg-muted/40 relative h-7 w-9 rounded-sm"
                        title={
                          cell
                            ? `${name} ${hourLabel(hour)} · ${cell.orderCount} ${t("pages.financeOrders")} · ${formatMoney(cell.revenue)}`
                            : undefined
                        }
                      >
                        {cell && (
                          <span
                            className="bg-primary absolute inset-0 rounded-sm"
                            style={{ opacity: 0.12 + 0.88 * strength }}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="pl-2 text-right whitespace-nowrap tabular-nums">
                    {formatMoney(data.byWeekday[weekday].revenue)}
                  </td>
                </tr>
              ))}
              <tr>
                <th className="text-muted-foreground pt-1 pr-2 text-left font-normal whitespace-nowrap">
                  {t("pages.financeOrders")}
                </th>
                {hours.map((hour) => (
                  <td key={hour} className="text-muted-foreground pt-1 text-center tabular-nums">
                    {data.byHour[hour].orderCount || ""}
                  </td>
                ))}
                <td className="pt-1 pl-2 text-right font-semibold whitespace-nowrap tabular-nums">
                  {formatMoney(typeTotals.revenue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Discounts & refunds ───

export function AdjustmentsTab({ scope, formatMoney }: InsightTabProps) {
  const { t } = useI18n();
  const query = useQuery(adjustmentsQuery(scope));
  const data = query.data;

  if (!data) {
    return (
      <TabState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
      />
    );
  }

  const discountTotals = sumColumns(data.discounts, ["orderCount", "amount"] as const);
  const refundTotals = sumColumns(data.refunds, ["orderCount", "amount"] as const);

  const reasonTable = (
    rows: typeof data.discounts,
    totals: { orderCount: number; amount: number },
    emptyLabel: string
  ) =>
    rows.length === 0 ? (
      <p className="text-muted-foreground rounded-lg border py-6 text-center text-sm">
        {emptyLabel}
      </p>
    ) : (
      <ScrollTable minWidth={440}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("pages.financeReason")}</TableHead>
            <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
            <TableHead className="text-right">{t("pages.financeAmount")}</TableHead>
            <TableHead className="text-right">{t("pages.financeShare")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.isCoupon}:${row.label ?? ""}`}>
              <TableCell className="font-medium">
                {row.isCoupon && (
                  <Badge variant="outline" className="mr-2 text-xs">
                    {t("pages.financeCoupon")}
                  </Badge>
                )}
                {row.label ?? (
                  <span className="text-muted-foreground italic">{t("pages.financeNoReason")}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(row.amount)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {sharePct(row.amount, totals.amount)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t("pages.financeTotal")}</TableCell>
            <TableCell className="text-right tabular-nums">{totals.orderCount}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(totals.amount)}</TableCell>
            <TableCell className="text-right tabular-nums">100%</TableCell>
          </TableRow>
        </TableFooter>
      </ScrollTable>
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("pages.financeDiscount")}
          value={formatMoney(discountTotals.amount)}
          sub={`${discountTotals.orderCount} ${t("pages.financeOrders")}`}
        />
        <StatCard
          label={t("pages.financeRefund")}
          value={formatMoney(refundTotals.amount)}
          sub={`${refundTotals.orderCount} ${t("pages.financeOrders")}`}
        />
        <StatCard
          label={t("pages.financeCancelledOrders")}
          value={formatMoney(data.cancelled.value)}
          sub={`${data.cancelled.orderCount} ${t("pages.financeOrders")}`}
        />
        <StatCard
          label={t("pages.financeVoidedItems")}
          value={formatMoney(data.voids.value)}
          sub={t("pages.financeVoidedSub")
            .replace("{lines}", String(data.voids.lineCount))
            .replace("{qty}", String(data.voids.quantity))}
        />
      </div>
      <p className="text-muted-foreground text-xs">{t("pages.financeAdjustmentsHint")}</p>

      <div className="space-y-2">
        <SectionTitle>{t("pages.financeDiscountsByReason")}</SectionTitle>
        {reasonTable(data.discounts, discountTotals, t("pages.financeNoDiscounts"))}
      </div>

      <div className="space-y-2">
        <SectionTitle>{t("pages.financeRefundsByReason")}</SectionTitle>
        {reasonTable(data.refunds, refundTotals, t("pages.financeNoRefunds"))}
      </div>

      <div className="space-y-2">
        <SectionTitle>{t("pages.financeMostVoided")}</SectionTitle>
        {data.voids.topItems.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border py-6 text-center text-sm">
            {t("pages.financeNoVoids")}
          </p>
        ) : (
          <ScrollTable minWidth={440}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("pages.financeTimesVoided")}</TableHead>
                <TableHead className="text-right">{t("pages.financeQtySold")}</TableHead>
                <TableHead className="text-right">{t("pages.financeAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.voids.topItems.map((item) => (
                <TableRow key={item.name}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.lineCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(item.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t("pages.financeAllVoids")}</TableCell>
                <TableCell className="text-right tabular-nums">{data.voids.lineCount}</TableCell>
                <TableCell className="text-right tabular-nums">{data.voids.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.voids.value)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </ScrollTable>
        )}
      </div>
    </div>
  );
}

// ─── Tax ───

export function TaxTab({ scope, formatMoney }: InsightTabProps) {
  const { t } = useI18n();
  const query = useQuery(taxQuery(scope));
  const data = query.data;

  if (!data) {
    return (
      <TabState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
      />
    );
  }

  const totals = sumColumns(data.rates, [
    "orderCount",
    "taxableBase",
    "taxCharged",
    "refundedTax",
    "taxOwed",
  ] as const);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">{t("pages.financeTaxHint")}</p>
      {data.rates.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t("pages.noData")}</p>
      ) : (
        <ScrollTable minWidth={640}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pages.financeTaxRate")}</TableHead>
              <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
              <TableHead className="text-right">{t("pages.financeTaxableBase")}</TableHead>
              <TableHead className="text-right">{t("pages.financeTaxCharged")}</TableHead>
              <TableHead className="text-right">{t("pages.financeTaxRefunded")}</TableHead>
              <TableHead className="text-right">{t("pages.financeTaxOwed")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rates.map((row) => (
              <TableRow key={row.ratePct}>
                <TableCell className="font-medium">
                  {row.ratePct > 0 ? `${row.ratePct}%` : t("pages.financeNoTax")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.taxableBase)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.taxCharged)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.refundedTax ? formatMoney(-row.refundedTax) : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(row.taxOwed)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>{t("pages.financeTotal")}</TableCell>
              <TableCell className="text-right tabular-nums">{totals.orderCount}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(totals.taxableBase)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(totals.taxCharged)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {totals.refundedTax ? formatMoney(-totals.refundedTax) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(totals.taxOwed)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </ScrollTable>
      )}
    </div>
  );
}

// ─── Labour ───

const PAY_TYPE_LABEL: Record<PayType, string> = {
  HOURLY: "pages.staffPayTypeHourly",
  MONTHLY: "pages.staffPayTypeMonthly",
  SALES: "pages.staffPayTypeSales",
  NONE: "pages.staffPayTypeNone",
};

const hoursOf = (minutes: number) => `${(minutes / 60).toFixed(1)} h`;

export function LabourTab({
  scope,
  formatMoney,
  summary,
}: InsightTabProps & { summary: SummaryData | undefined }) {
  const { t } = useI18n();
  const query = useQuery(labourQuery(scope));
  const data = query.data;

  if (!data) {
    return (
      <TabState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
      />
    );
  }

  const netSales = summary?.netSales ?? 0;
  const cogs = summary?.cogs ?? 0;
  const labour = data.totals.cost;
  const primeCost = Math.round((cogs + labour) * 100) / 100;
  const rateLabel = (payType: PayType, rate: number | null) =>
    rate == null
      ? "—"
      : payType === "HOURLY"
        ? t("pages.financeRatePerHour").replace("{rate}", formatMoney(rate))
        : payType === "MONTHLY"
          ? t("pages.financeRatePerMonth").replace("{rate}", formatMoney(rate))
          : payType === "SALES"
            ? `${rate}%`
            : "—";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("pages.financeLabourCost")}
          value={formatMoney(labour)}
          sub={t("pages.financeEstimated")}
        />
        <StatCard
          label={t("pages.financeLabourPct")}
          value={summary && netSales > 0 ? `${sharePct(labour, netSales).toFixed(1)}%` : "—"}
          sub={summary ? t("pages.financeOfNetSales") : t("pages.financeWholeStoreOnly")}
        />
        <StatCard
          label={t("pages.financePrimeCost")}
          value={summary ? formatMoney(primeCost) : "—"}
          sub={
            !summary
              ? t("pages.financeWholeStoreOnly")
              : netSales > 0
                ? `${sharePct(primeCost, netSales).toFixed(1)}% ${t("pages.financeOfNetSales")}`
                : t("pages.financePrimeCostHint")
          }
        />
        <StatCard
          label={t("pages.financeHoursWorked")}
          value={hoursOf(data.totals.workedMinutes)}
          sub={t("pages.financeFromAttendance")}
        />
      </div>

      {data.rows.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t("pages.financeNoStaff")}
        </p>
      ) : (
        <ScrollTable minWidth={680}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pages.financeStaff")}</TableHead>
              <TableHead>{t("pages.staffPayType")}</TableHead>
              <TableHead className="text-right">{t("pages.staffPayRate")}</TableHead>
              <TableHead className="text-right">{t("pages.financeHoursWorked")}</TableHead>
              <TableHead className="text-right">{t("pages.financeDaysWorked")}</TableHead>
              <TableHead className="text-right">{t("pages.financeLabourCost")}</TableHead>
              <TableHead className="text-right">{t("pages.financeShare")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.staffMemberId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {t(PAY_TYPE_LABEL[row.payType])}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {rateLabel(row.payType, row.payRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {hoursOf(row.workedMinutes)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.workedDays}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {data.payHidden ? (
                    <span className="text-muted-foreground font-normal">—</span>
                  ) : row.cost != null ? (
                    formatMoney(row.cost)
                  ) : (
                    <span className="text-muted-foreground text-xs font-normal">
                      {row.basis === "commission"
                        ? t("pages.financeNotEstimatedCommission")
                        : t("pages.financeNotEstimatedNoRate")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {row.cost != null ? `${sharePct(row.cost, labour)}%` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>{t("pages.financeTotal")}</TableCell>
              <TableCell className="text-right tabular-nums">
                {hoursOf(data.totals.workedMinutes)}
              </TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatMoney(labour)}</TableCell>
              <TableCell className="text-right tabular-nums">100%</TableCell>
            </TableRow>
          </TableFooter>
        </ScrollTable>
      )}

      <div className="bg-muted/40 text-muted-foreground space-y-1 rounded-lg border p-3 text-xs">
        <p>{t("pages.financeLabourHint")}</p>
        {data.payHidden && <p>{t("pages.financeLabourPayOwnerOnly")}</p>}
        {data.totals.notEstimated > 0 && (
          <p>
            {t("pages.financeLabourNotEstimated").replace(
              "{count}",
              String(data.totals.notEstimated)
            )}
          </p>
        )}
        {data.missingClockOuts > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            {t("pages.financeLabourMissingClockOuts").replace(
              "{count}",
              String(data.missingClockOuts)
            )}
          </p>
        )}
      </div>
    </div>
  );
}
