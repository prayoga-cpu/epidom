"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";

interface SchedulePrintRow {
  date: string;
  staffName: string;
  isDayOff: boolean;
  scheduleShiftLabel: string | null;
  customStartTime: string | null;
  customEndTime: string | null;
  department: string | null;
  status: "DRAFT" | "PUBLISHED";
}

interface SchedulePrintViewProps {
  storeName: string;
  from: string;
  to: string;
  rows: SchedulePrintRow[];
  generatedAt: string;
}

export function SchedulePrintView({ storeName, from, to, rows, generatedAt }: SchedulePrintViewProps) {
  const { t } = useI18n();

  return (
    <PrintReportShell
      title={t("pages.scheduleTitle")}
      storeName={storeName}
      generatedAt={generatedAt}
      subtitle={
        <p className="text-gray-800">
          {t("pos.printReport.filterDateRange")}: {from} – {to}
        </p>
      }
    >
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-2 font-semibold">{t("common.date")}</th>
            <th className="py-2 pr-2 font-semibold">{t("pages.staff")}</th>
            <th className="py-2 pr-2 font-semibold">{t("pages.scheduleShiftBlockLabel")}</th>
            <th className="py-2 pr-2 font-semibold">{t("pages.scheduleDepartment")}</th>
            <th className="py-2 pl-2 font-semibold">{t("pages.scheduleStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-200 break-inside-avoid">
              <td className="py-1.5 pr-2 whitespace-nowrap">{row.date}</td>
              <td className="py-1.5 pr-2">{row.staffName}</td>
              <td className="py-1.5 pr-2">
                {row.isDayOff
                  ? t("pages.scheduleDayOffOn")
                  : (row.scheduleShiftLabel ?? `${row.customStartTime}–${row.customEndTime}`)}
              </td>
              <td className="py-1.5 pr-2">{row.department ?? "—"}</td>
              <td className="py-1.5 pl-2">
                {row.status === "PUBLISHED"
                  ? t("pages.schedulePublishedBadge")
                  : t("pages.scheduleDraftBadge")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-700">{t("pages.noData")}</p>
      )}
    </PrintReportShell>
  );
}
