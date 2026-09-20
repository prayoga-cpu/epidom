"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangeField } from "@/components/ui/date-range-field";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { startOfMonthLocalISO, todayLocalISO } from "@/lib/utils/date-range";
import { shiftReportPath } from "@/lib/finance/shift-report-path";
import type { CashReconciliationRow } from "@/lib/finance/report-aggregation";
import { DIFFERENCE_TONE_CLASSES, differenceTone } from "@/features/pos/lib/shift-summary";

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

/** The slice of the shared log the cash tab shows — see /api/stores/[id]/schedule/log. */
interface CashLogRow {
  id: string;
  timestamp: string;
  staffName: string;
  type: "CASH_IN" | "CASH_OUT";
  /**
   * What the row is. A shift's opening float and closing COUNT are not money crossing the
   * drawer, so they are not labelled Cash In / Cash Out — only real movements are.
   */
  origin: "attendance" | "shift-open" | "shift-close" | "movement";
  /** A cash movement's reason, or a till session's close-out notes. */
  notes: string | null;
  amount: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-muted/40 min-w-[9rem] flex-1 rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

/**
 * The manager's shift report — every till session in a period: who ran it, the
 * cash it opened with, what it should hold, what was counted and the gap.
 *
 * Its own page, not a tab of Schedule: attendance answers "who was on the
 * clock", this answers "what was in the drawer", and they were being read off
 * one mixed timeline. Opening and finishing a shift stays on POS Mode's Shift
 * page — this only reads them back.
 */
export function ShiftsClient({ storeId, staff }: { storeId: string; staff: StaffOption[] }) {
  const { t, formatDateTime, formatTimeOnly } = useI18n();
  // Every amount here is Shift/CashMovement-derived and already literal in the
  // store's own currency — the bare one-arg formatPrice() would treat it as IDR
  // and re-scale it for a non-IDR store.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const money = (value: number) => formatPriceRaw(value, currency);

  const [from, setFrom] = useState(startOfMonthLocalISO());
  const [to, setTo] = useState(todayLocalISO());
  const [staffId, setStaffId] = useState("all");
  const [tab, setTab] = useState<"report" | "cash">("report");

  const range = {
    from: new Date(from).toISOString(),
    to: new Date(new Date(to).getTime() + 86_400_000 - 1).toISOString(),
    ...(staffId !== "all" && { staffId }),
  };

  const report = useQuery({
    queryKey: ["shifts-report", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ shifts: CashReconciliationRow[] }>(
        `/stores/${storeId}/finance/cash-reconciliation`,
        range
      ),
  });

  const cashLog = useQuery({
    queryKey: ["shifts-cash-log", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{ records: CashLogRow[] }>(`/stores/${storeId}/schedule/log`, {
        ...range,
        type: "CASH_IN,CASH_OUT",
      }),
    enabled: tab === "cash",
  });

  const rows = report.data?.shifts ?? [];
  const flagged = rows.filter((r) => r.isFlagged).length;
  // Only counted drawers have a difference; an open till has none yet.
  const net = round2(rows.reduce((sum, r) => sum + (r.cashDifference ?? 0), 0));

  const toneLabel = {
    pending: null,
    balanced: t("pos.shift.differenceBalanced"),
    over: t("pos.shift.differenceOver"),
    short: t("pos.shift.differenceShort"),
  } as const;

  // "Sep 19, 10:59 PM – 11:04 PM"; an overnight shift repeats the date on the end.
  const period = (row: CashReconciliationRow) => {
    const start = formatDateTime(row.openedAt);
    if (!row.closedAt) return start;
    const sameDay = new Date(row.openedAt).toDateString() === new Date(row.closedAt).toDateString();
    return `${start} – ${sameDay ? formatTimeOnly(row.closedAt) : formatDateTime(row.closedAt)}`;
  };

  // A shift's float / count keep their own words; only real movements read Cash In / Out.
  const cashLogLabel = (record: CashLogRow) =>
    record.origin === "shift-open"
      ? t("pages.shiftsCashOpened")
      : record.origin === "shift-close"
        ? t("pages.shiftsCashClosed")
        : record.type === "CASH_IN"
          ? t("clockInOut.typeCashIn")
          : t("clockInOut.typeCashOut");

  const message = (text: string, colSpan: number) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground text-center">
        {text}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("pages.shiftsTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("pages.shiftsDesc")}</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="space-y-1">
          <Label htmlFor="shifts-date-range">{t("common.datePicker.dateRange")}</Label>
          <DateRangeField
            id="shifts-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("pages.attendanceFilterStaff")}</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.attendanceFilterAllStaff")}</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "report" | "cash")}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="report">{t("pages.shiftsReportTab")}</TabsTrigger>
          <TabsTrigger value="cash">{t("pages.shiftsCashLogTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-4">
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <Stat label={t("pages.shiftsStatShifts")} value={String(rows.length)} />
              <Stat
                label={t("pages.shiftsStatFlagged")}
                value={String(flagged)}
                tone={flagged > 0 ? "text-destructive" : undefined}
              />
              <Stat
                label={t("pages.shiftsStatNet")}
                value={money(net)}
                tone={net < 0 ? "text-destructive" : undefined}
              />
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("pages.shiftsColShift")}</TableHead>
                      <TableHead className="text-right align-bottom whitespace-normal">
                        {t("pages.financeOpeningCash")}
                      </TableHead>
                      <TableHead className="text-right align-bottom whitespace-normal">
                        {t("pages.financeCashSales")}
                      </TableHead>
                      <TableHead className="text-right align-bottom whitespace-normal">
                        {t("pages.financeExpectedCash")}
                      </TableHead>
                      <TableHead className="text-right align-bottom whitespace-normal">
                        {t("pages.financeClosingCash")}
                      </TableHead>
                      <TableHead className="text-right align-bottom whitespace-normal">
                        {t("pages.financeCashDifference")}
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">{t("pages.shiftsColReport")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.isLoading
                      ? message(t("common.loading"), 7)
                      : report.isError
                        ? message(t("pages.financeLoadError"), 7)
                        : rows.length === 0
                          ? message(t("pages.noData"), 7)
                          : rows.map((row) => {
                              const tone = differenceTone(row.cashDifference);
                              return (
                                <TableRow
                                  key={row.shiftId}
                                  className={row.isFlagged ? "bg-destructive/5" : undefined}
                                >
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {/* Wraps on purpose: as one nowrap line this cell alone is ~250px, which pushed the table past
                                          its card at 1024-1280px and clipped the report button. */}
                                      <span className="font-medium">{period(row)}</span>
                                      {row.isOpen && (
                                        <Badge variant="default">
                                          {t("pages.financeShiftStatusOpen")}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground text-xs">{row.staffName}</p>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {money(row.openingCash)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {money(row.cashSales)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {money(row.expectedCash)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {row.closingCash != null ? money(row.closingCash) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {tone === "pending" || row.cashDifference == null ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
                                          DIFFERENCE_TONE_CLASSES[tone]
                                        )}
                                      >
                                        {toneLabel[tone]}
                                        {tone !== "balanced" &&
                                          ` ${money(Math.abs(row.cashDifference))}`}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm" className="h-10">
                                      <a
                                        href={shiftReportPath(storeId, row.shiftId)}
                                        aria-label={t("pos.shift.openReport")}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="mr-1.5 size-3.5" aria-hidden />
                                        {t("pages.shiftsColReport")}
                                      </a>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card>
            <CardContent className="pt-4">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.timestamp") ?? "Time"}</TableHead>
                      <TableHead>{t("pages.staff") ?? "Staff"}</TableHead>
                      <TableHead>{t("pages.attendanceTypeColumn")}</TableHead>
                      <TableHead>{t("pages.scheduleLogDetailColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashLog.isLoading
                      ? message(t("common.loading"), 4)
                      : cashLog.isError
                        ? message(t("pages.financeLoadError"), 4)
                        : (cashLog.data?.records.length ?? 0) === 0
                          ? message(t("pages.noData"), 4)
                          : cashLog.data!.records.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell className="whitespace-nowrap">
                                  {formatDateTime(record.timestamp)}
                                </TableCell>
                                <TableCell>{record.staffName}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={record.type === "CASH_IN" ? "default" : "secondary"}
                                  >
                                    {cashLogLabel(record)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {/* An amount plus, for a real cash movement, the
                                      reason the money moved — which for a paid-out or
                                      safe drop is the only part a manager is auditing. */}
                                  <div className="space-y-0.5">
                                    <span className="font-medium whitespace-nowrap">
                                      {record.amount != null ? money(record.amount) : "—"}
                                    </span>
                                    {record.notes && (
                                      // line-clamp, not truncate: the reason is the audit
                                      // trail, and a title tooltip would hide it from the
                                      // iPad this page is read on.
                                      <p className="text-muted-foreground line-clamp-2 max-w-[260px] text-xs break-words">
                                        {record.notes}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
