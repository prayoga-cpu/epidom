"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";
import { formatDateTime } from "@/lib/utils/formatting";

interface LogRow {
  timestamp: string;
  staffName: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";
  hasSelfie: boolean;
  locationLabel: string | null;
  amountFormatted?: string | null;
}

interface HoursRow {
  date: string;
  staffName: string;
  regularMinutes: number;
  overtimeMinutes: number;
}

interface AttendancePrintViewProps {
  storeName: string;
  from: string;
  to: string;
  generatedAt: string;
  logRows?: LogRow[];
  hoursRows?: HoursRow[];
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function AttendancePrintView({
  storeName,
  from,
  to,
  generatedAt,
  logRows,
  hoursRows,
}: AttendancePrintViewProps) {
  const { t } = useI18n();
  const isHours = !!hoursRows;

  return (
    <PrintReportShell
      title={isHours ? t("pages.attendanceHoursTab") : t("pages.attendanceLogTab")}
      storeName={storeName}
      generatedAt={generatedAt}
      subtitle={
        <p className="text-gray-800">
          {t("pos.printReport.filterDateRange")}: {from} – {to}
        </p>
      }
    >
      {isHours ? (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2 font-semibold">{t("common.date")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.staff")}</th>
              <th className="py-2 pr-2 font-semibold">{t("pages.attendanceRegularMinutes")}</th>
              <th className="py-2 pl-2 font-semibold">{t("pages.attendanceOvertimeMinutes")}</th>
            </tr>
          </thead>
          <tbody>
            {hoursRows!.map((row, i) => (
              <tr key={i} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1.5 pr-2 whitespace-nowrap">{row.date}</td>
                <td className="py-1.5 pr-2">{row.staffName}</td>
                <td className="py-1.5 pr-2">{formatMinutes(row.regularMinutes)}</td>
                <td className="py-1.5 pl-2">
                  {row.overtimeMinutes > 0 ? formatMinutes(row.overtimeMinutes) : "—"}
                </td>
              </tr>
            ))}
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
      {(isHours ? hoursRows!.length : logRows!.length) === 0 && (
        <p className="py-12 text-center text-sm text-gray-700">{t("pages.noData")}</p>
      )}
    </PrintReportShell>
  );
}
