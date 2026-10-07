"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { parseLocalISO } from "@/lib/utils/date-range";
import type { StaffPayroll } from "@/lib/attendance/payroll";
import type { HoursReportRow } from "@/lib/attendance/hours-report";
import { differenceTone, useHoursFormat } from "./use-hours-format";

/** A fraction of a month as "0.48 month"-style text: two decimals, trailing zeros trimmed. */
function formatFraction(value: number): string {
  return String(Math.round(value * 100) / 100);
}

interface PayrollBreakdownProps {
  payroll: StaffPayroll;
  currency: string;
  /** Hide the day-by-day list (the owner's table row already sits under the Hours tab). */
  showDays?: boolean;
}

/**
 * How one person's pay adds up: base, each allowance, overtime, total — each
 * line with the arithmetic behind it — then the days it came from. Shared by
 * the owner's Salary tab and a staff member's own My Pay tab, so both read
 * the same numbers the same way.
 */
export function PayrollBreakdown({ payroll, currency, showDays = true }: PayrollBreakdownProps) {
  const { t } = useI18n();
  const { duration, money } = useHoursFormat();
  const hours = (h: number) => duration(Math.round(h * 60));

  const base = payroll.base;
  const baseDetail =
    base.kind === "hourly"
      ? t("pages.payrollBaseHourly").replace("{hours}", hours(base.hours)).replace("{rate}", money(base.rate, currency))
      : base.kind === "monthly"
        ? base.monthFraction === 1
          ? t("pages.payrollBaseMonthlyFull").replace("{rate}", money(base.rate, currency))
          : t("pages.payrollBaseMonthly")
              .replace("{rate}", money(base.rate, currency))
              .replace("{fraction}", formatFraction(base.monthFraction))
        : base.kind === "sales"
          ? t("pages.payrollBaseSales")
              .replace("{percent}", String(base.percent))
              .replace("{sales}", money(base.sales, currency))
          : t("pages.payrollBaseNotSet");

  const overtime = payroll.overtime;
  const showOvertime = overtime.hours > 0 || overtime.amount !== null;
  const overtimeDetail =
    overtime.rate !== null
      ? t("pages.payrollOvertimeLine").replace("{hours}", hours(overtime.hours)).replace("{rate}", money(overtime.rate, currency))
      : t("pages.payrollOvertimeNotPaid").replace("{hours}", hours(overtime.hours));

  return (
    <div className="space-y-4">
      <dl className="divide-border/60 divide-y rounded-lg border text-sm">
        <Line label={t("pages.payrollLineBase")} detail={baseDetail} amount={base.amount !== null ? money(base.amount, currency) : t("pages.payrollNotSet")} />
        {payroll.allowances.map((line) => (
          <Line
            key={line.id}
            label={line.name}
            detail={
              line.basis === "PER_DAY"
                ? t("pages.payrollAllowancePerDay")
                    .replace("{rate}", money(line.rate, currency))
                    .replace("{days}", String(line.quantity))
                : t("pages.payrollAllowancePerMonth")
                    .replace("{rate}", money(line.rate, currency))
                    .replace("{fraction}", formatFraction(line.quantity))
            }
            amount={money(line.amount, currency)}
          />
        ))}
        {showOvertime && (
          <Line
            label={t("pages.payrollLineOvertime")}
            detail={overtimeDetail}
            amount={overtime.amount !== null ? money(overtime.amount, currency) : "—"}
          />
        )}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 font-semibold">
          <dt>{t("pages.payrollLineTotal")}</dt>
          <dd className="tabular-nums">{money(payroll.total, currency)}</dd>
        </div>
      </dl>

      {base.kind === "sales" && <p className="text-muted-foreground text-xs">{t("pages.payrollSalesNote")}</p>}
      {payroll.incompleteDays > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("pages.payrollIncompleteWarning").replace("{count}", String(payroll.incompleteDays))}
        </p>
      )}
      {payroll.longDays > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("pages.payrollLongDaysWarning").replace("{count}", String(payroll.longDays))}
        </p>
      )}

      {showDays && payroll.days.length > 0 && <PayrollDays days={payroll.days} />}
    </div>
  );
}

function Line({ label, detail, amount }: { label: string; detail: string; amount: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <dt className="min-w-0">
        <span className="block font-medium break-words">{label}</span>
        <span className="text-muted-foreground block text-xs break-words">{detail}</span>
      </dt>
      <dd className="shrink-0 tabular-nums">{amount}</dd>
    </div>
  );
}

/** The days a period's pay came from — compact enough for a phone-width POS tab. */
function PayrollDays({ days }: { days: HoursReportRow[] }) {
  const { t, dateLocale } = useI18n();
  const { duration, signedDuration } = useHoursFormat();

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {t("pages.payrollDayTableTitle")}
      </p>
      <ul className="divide-border/60 divide-y rounded-lg border text-sm">
        {days.map((day) => (
          <li key={`${day.staffMemberId}:${day.date}`} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="font-medium">{format(parseLocalISO(day.date), "EEE d MMM", { locale: dateLocale })}</p>
              <p className="text-muted-foreground text-xs">
                <DayTimes day={day} />
              </p>
              {day.hasLongPair && <LongPairWarning />}
            </div>
            <div className="shrink-0 text-right">
              <DayStatus day={day} fallback={<span className="tabular-nums">{duration(day.workedMinutes)}</span>} />
              {day.differenceMinutes !== null && (
                <p className={`text-xs tabular-nums ${differenceTone(day.differenceMinutes)}`}>
                  {signedDuration(day.differenceMinutes)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "08:00–17:02, 18:00–20:00", "08:00–…" while a clock-out is pending, "—" with no clock-in. */
export function DayTimes({ day }: { day: HoursReportRow }) {
  const ranges = day.pairs.map((p) => `${p.clockInTime}–${p.clockOutTime}`);
  if (day.openClockIn) ranges.push(`${day.openClockIn.clockInTime}–…`);
  return <>{ranges.length > 0 ? ranges.join(", ") : "—"}</>;
}

/** Shown under a day's times when a clock-in → clock-out stretch is implausibly long. */
export function LongPairWarning() {
  const { t } = useI18n();
  return (
    <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {t("pages.attendanceLongPairWarning")}
    </p>
  );
}

/** A badge for a day that isn't a plain worked day; `fallback` otherwise. */
export function DayStatus({ day, fallback }: { day: HoursReportRow; fallback: ReactNode }) {
  const { t } = useI18n();
  switch (day.status) {
    case "onClock":
      return <Badge variant="secondary">{t("pages.attendanceStatusOnClock")}</Badge>;
    case "missingClockOut":
      return (
        <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">
          {t("pages.attendanceStatusMissingClockOut")}
        </Badge>
      );
    case "absent":
      return <Badge variant="destructive">{t("pages.attendanceStatusAbsent")}</Badge>;
    case "noShow":
      return <Badge variant="destructive">{t("pages.attendanceStatusNoShow")}</Badge>;
    default:
      return <>{fallback}</>;
  }
}
