"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";
import { formatDuration, formatSignedDuration, type DurationUnits } from "@/lib/attendance/format-duration";
import type { HoursReportRow } from "@/lib/attendance/hours-report";
import type { PayrollReport } from "@/lib/attendance/fetch-payroll";
import type { PayType } from "@/lib/attendance/payroll";
import { formatCurrency } from "@/lib/utils/formatting";
import { PayrollBreakdown } from "@/features/dashboard/schedule/components/payroll-breakdown";

interface LogRow {
  timestamp: string;
  staffName: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";
  hasSelfie: boolean;
  locationLabel: string | null;
  amountFormatted?: string | null;
}

export interface PrintHoursRow extends HoursReportRow {
  staffName: string;
}

interface AttendancePrintViewProps {
  storeName: string;
  from: string;
  to: string;
  generatedAt: string;
  logRows?: LogRow[];
  hoursRows?: PrintHoursRow[];
  payroll?: PayrollReport;
}

const PAY_TYPE_KEY: Record<PayType, string> = {
  HOURLY: "pages.payrollPayTypeHourly",
  MONTHLY: "pages.payrollPayTypeMonthly",
  SALES: "pages.payrollPayTypeSales",
  NONE: "pages.payrollNotSet",
};

export function AttendancePrintView({
  storeName,
  from,
  to,
  generatedAt,
  logRows,
  hoursRows,
  payroll,
}: AttendancePrintViewProps) {
  const { t, formatDateTime, intlLocale } = useI18n();
  const units: DurationUnits = {
    hour: t("pages.attendanceDurationHourUnit"),
    minute: t("pages.attendanceDurationMinuteUnit"),
  };
  const duration = (minutes: number) => formatDuration(minutes, units);
  const money = (amount: number) => formatCurrency(amount, payroll?.currency, intlLocale);

  const title = payroll
    ? t("pages.payrollTab")
    : hoursRows
      ? t("pages.attendanceHoursTab")
      : t("pages.attendanceLogTab");
  const rowCount = payroll ? payroll.staff.length : hoursRows ? hoursRows.length : (logRows?.length ?? 0);

  const statusLabel = (row: PrintHoursRow): string | null => {
    switch (row.status) {
      case "onClock":
        return t("pages.attendanceStatusOnClock");
      case "missingClockOut":
        return t("pages.attendanceStatusMissingClockOut");
      case "absent":
        return t("pages.attendanceStatusAbsent");
      case "noShow":
        return t("pages.attendanceStatusNoShow");
      default:
        return null;
    }
  };

  return (
    <PrintReportShell
      title={title}
      storeName={storeName}
      generatedAt={generatedAt}
      subtitle={
        <p className="text-gray-800">
          {t("pos.printReport.filterDateRange")}: {from} – {to}
        </p>
      }
    >
      {payroll ? (
        <div className="space-y-6">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2 pr-2 font-semibold">{t("pages.staff")}</th>
                <th className="py-2 pr-2 font-semibold">{t("pages.payrollColumnPay")}</th>
                <th className="py-2 pr-2 text-right font-semibold">{t("pages.payrollColumnDays")}</th>
                <th className="py-2 pr-2 text-right font-semibold">{t("pages.payrollColumnHours")}</th>
                <th className="py-2 pr-2 text-right font-semibold">{t("pages.payrollColumnBase")}</th>
                <th className="py-2 pr-2 text-right font-semibold">{t("pages.payrollColumnAllowances")}</th>
                <th className="py-2 pr-2 text-right font-semibold">{t("pages.payrollColumnOvertime")}</th>
                <th className="py-2 pl-2 text-right font-semibold">{t("pages.payrollColumnTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {payroll.staff.map((p) => (
                <tr key={p.staffMemberId} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1.5 pr-2">{p.name}</td>
                  <td className="py-1.5 pr-2">{t(PAY_TYPE_KEY[p.payType])}</td>
                  <td className="py-1.5 pr-2 text-right">{p.daysPresent}</td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                    {duration(p.workedMinutes)}
                    {p.differenceMinutes !== 0 && ` (${formatSignedDuration(p.differenceMinutes, units)})`}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {p.base.amount !== null ? money(p.base.amount) : t("pages.payrollNotSet")}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{money(p.allowanceTotal)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {p.overtime.amount !== null ? money(p.overtime.amount) : "—"}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-semibold">{money(p.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-black font-semibold">
                <td className="py-2 pr-2" colSpan={7}>
                  {t("pages.payrollTotalLabel")}
                </td>
                <td className="py-2 pl-2 text-right">{money(payroll.total)}</td>
              </tr>
            </tbody>
          </table>

          {payroll.staff.map((p) => (
            <section key={p.staffMemberId} className="space-y-2 break-inside-avoid">
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <PayrollBreakdown payroll={p} currency={payroll.currency} showDays={false} />
            </section>
          ))}
          <p className="text-xs text-gray-700">{t("pages.payrollRatesNote")}</p>
        </div>
      ) : hoursRows ? (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2 font-semibold">{t("common.date")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.staff")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.attendanceInOutColumn")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.attendanceExpectedColumn")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.attendanceWorkedColumn")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.attendanceDifferenceColumn")}</th>
              <th className="py-2 pl-2 font-semibold">{t("pages.attendanceOvertimeMinutes")}</th>
            </tr>
          </thead>
          <tbody>
            {hoursRows.map((row) => {
              const times = row.pairs.map((p) => `${p.clockInTime}–${p.clockOutTime}`);
              if (row.openClockIn) times.push(`${row.openClockIn.clockInTime}–…`);
              return (
                <tr
                  key={`${row.staffMemberId}:${row.date}`}
                  className="border-b border-gray-200 break-inside-avoid"
                >
                  <td className="py-1.5 pr-2 whitespace-nowrap">{row.date}</td>
                  <td className="py-1.5 pr-2">{row.staffName}</td>
                  <td className="py-1.5 pr-2">{times.length > 0 ? times.join(", ") : "—"}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {duration(row.expectedMinutes)}
                    {row.expectedSource === "dayOff" && ` (${t("pages.attendanceExpectedDayOff")})`}
                  </td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {statusLabel(row) ?? duration(row.workedMinutes)}
                  </td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {row.differenceMinutes !== null
                      ? formatSignedDuration(row.differenceMinutes, units)
                      : "—"}
                  </td>
                  <td className="py-1.5 pl-2">
                    {row.overtimeMinutes > 0 ? duration(row.overtimeMinutes) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2 font-semibold">{t("common.timestamp")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.staff")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.attendanceTypeColumn")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.scheduleLogDetailColumn")}</th>
              <th className="py-2 pl-2 font-semibold">{t("pages.attendanceLocationColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {logRows!.map((row, i) => (
              <tr key={i} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(row.timestamp)}</td>
                <td className="py-1.5 pr-2">{row.staffName}</td>
                <td className="py-1.5 pr-2">
                  {row.type === "CLOCK_IN"
                    ? t("clockInOut.typeClockIn")
                    : row.type === "CLOCK_OUT"
                      ? t("clockInOut.typeClockOut")
                      : row.type === "ABSENCE"
                        ? t("clockInOut.typeAbsence")
                        : row.type === "CASH_IN"
                          ? t("clockInOut.typeCashIn")
                          : t("clockInOut.typeCashOut")}
                </td>
                <td className="py-1.5 pr-2">
                  {row.amountFormatted ?? (row.hasSelfie ? "✓" : "—")}
                </td>
                <td className="py-1.5 pl-2">
                  {row.locationLabel ?? t("pages.attendanceCoordinatesUnavailable")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rowCount === 0 && (
        <p className="py-12 text-center text-sm text-gray-700">
          {payroll ? t("pages.payrollEmpty") : t("pages.noData")}
        </p>
      )}
    </PrintReportShell>
  );
}
