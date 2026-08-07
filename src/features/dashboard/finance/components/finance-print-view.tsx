"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";
import { formatDateTime } from "@/lib/utils/formatting";

interface SummaryData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  wasteLoss: number;
  taxCollected: number;
  serviceCharge: number;
  processingFee: number;
  netRevenue: number;
  netProfit: number;
  orderCount: number;
  buckets: { date: string; revenue: number }[];
}

interface WasteReasonRow {
  reason: string;
  label: string;
  entryCount: number;
  totalQuantity: number;
  totalValue: number;
}

interface WasteEntryRow {
  id: string;
  createdAt: string;
  itemName: string;
  reasonLabel: string;
  quantity: number;
  unit: string;
  unitCostSnapshot: number;
  totalValue: number;
  notes: string | null;
}

interface ChannelRow {
  source: string;
  label: string;
  orderCount: number;
  revenue: number;
  commissionPct: number;
  commissionAmount: number;
  taxAmount: number;
  processingFeeAmount: number;
  netRevenue: number;
}

interface TopItem {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface CategoryRow {
  categoryId: string | null;
  categoryName: string;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface DepartmentRow {
  department: "KITCHEN" | "BAR" | null;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface ShiftRow {
  shiftId: string | null;
  staffName: string;
  openedAt: string | null;
  closedAt: string | null;
  isOpen: boolean;
  orderCount: number;
  revenue: number;
}

interface ScheduleShiftBucketRow {
  scheduleShiftId: string;
  name: string;
  date: string;
  orderCount: number;
  revenue: number;
  color: string | null;
  staffOnDuty: { staffMemberId: string; name: string }[];
}

interface FinancePrintViewProps {
  storeName: string;
  currency: string;
  from: string;
  to: string;
  generatedAt: string;
  filters: {
    staffLabel: string | null;
    categoryId: string | null;
    categoryName: string | null;
    department: string | null;
  };
  summary: SummaryData;
  channels: ChannelRow[];
  topItems: TopItem[];
  categories: CategoryRow[];
  departments: DepartmentRow[];
  shifts: ShiftRow[];
  scheduleShiftRows: ScheduleShiftBucketRow[];
  wasteReasons: WasteReasonRow[];
  wasteEntries: WasteEntryRow[];
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 border-b border-black pb-1 text-xs font-bold tracking-wide text-black uppercase">
        {title}
      </h2>
      {note && <p className="mb-2 text-[10px] text-gray-600">{note}</p>}
      {children}
    </section>
  );
}

/**
 * Full-detail PDF companion to the Finance Reports dashboard (via browser
 * print → Save as PDF, same convention as Attendance/Schedule/Order History)
 * — mirrors every section the Excel export covers so the two "download"
 * options never drift apart in what they report.
 */
export function FinancePrintView({
  storeName,
  currency,
  from,
  to,
  generatedAt,
  filters,
  summary,
  channels,
  topItems,
  categories,
  departments,
  shifts,
  scheduleShiftRows,
  wasteReasons,
  wasteEntries,
}: FinancePrintViewProps) {
  const { t } = useI18n();
  const { formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const filterChips: string[] = [`${t("pos.printReport.filterDateRange")}: ${from} – ${to}`];
  if (filters.staffLabel) {
    filterChips.push(`${t("pos.printReport.filterStaff")}: ${filters.staffLabel}`);
  }
  if (filters.categoryId === "none") {
    filterChips.push(`${t("pages.financeCategory")}: ${t("pages.financeUncategorized")}`);
  } else if (filters.categoryName) {
    filterChips.push(`${t("pages.financeCategory")}: ${filters.categoryName}`);
  }
  if (filters.department === "KITCHEN" || filters.department === "BAR") {
    const label =
      filters.department === "KITCHEN" ? t("common.departmentKitchen") : t("common.departmentBar");
    filterChips.push(`${t("common.department")}: ${label}`);
  }

  const summaryTiles: [string, string][] = [
    [t("pages.financeRevenue"), formatPrice(summary.revenue)],
    [t("pages.financeCogs"), formatPrice(summary.cogs)],
    [t("pages.financeGrossProfit"), formatPrice(summary.grossProfit)],
    [t("pages.financeMargin"), `${summary.grossMarginPct.toFixed(1)}%`],
    [t("pages.financeTax"), formatPrice(summary.taxCollected)],
    [t("pages.financeServiceCharge"), formatPrice(summary.serviceCharge)],
    [t("pages.financeProcessingFee"), formatPrice(summary.processingFee)],
    [t("pages.financeNetRevenue"), formatPrice(summary.netRevenue)],
    [t("pages.financeWasteLoss"), formatPrice(summary.wasteLoss)],
    [t("pages.financeNetProfit"), formatPrice(summary.netProfit)],
  ];

  return (
    <PrintReportShell
      title={t("pages.financeTitle")}
      storeName={storeName}
      generatedAt={generatedAt}
      subtitle={<p className="text-gray-800">{filterChips.join("  ·  ")}</p>}
    >
      <Section title={t("pages.financeSummarySheet")}>
        <div className="grid grid-cols-3 gap-2">
          {summaryTiles.map(([label, value]) => (
            <div key={label} className="rounded border border-gray-300 p-2 break-inside-avoid">
              <p className="text-[9px] tracking-wide text-gray-600 uppercase">{label}</p>
              <p className="text-sm font-semibold text-black">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-gray-600">
          {summary.orderCount} {t("pages.financeOrders")}
        </p>
      </Section>

      {departments.length > 0 && (
        <Section title={t("pages.financeDepartmentSplit")}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-1.5 pr-2 font-semibold">{t("common.department")}</th>
                <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeQtySold")}</th>
                <th className="py-1.5 pl-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.department ?? "unassigned"} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1 pr-2">
                    {d.department === "KITCHEN"
                      ? t("common.departmentKitchen")
                      : d.department === "BAR"
                        ? t("common.departmentBar")
                        : t("common.departmentUnassigned")}
                  </td>
                  <td className="py-1 pr-2 text-right">{d.totalQuantity}</td>
                  <td className="py-1 pl-2 text-right font-semibold">{formatPrice(d.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title={t("pages.financeChannels")}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">{t("pages.financeChannel")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeOrders")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeCommission")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeProcessingFee")}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">{t("pages.financeNetRevenue")}</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.source} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1 pr-2 font-medium">{c.label}</td>
                <td className="py-1 pr-2 text-right">{c.orderCount}</td>
                <td className="py-1 pr-2 text-right">{formatPrice(c.revenue)}</td>
                <td className="py-1 pr-2 text-right">
                  {c.commissionPct > 0 ? `-${c.commissionPct}% (${formatPrice(c.commissionAmount)})` : "—"}
                </td>
                <td className="py-1 pr-2 text-right">
                  {c.processingFeeAmount > 0 ? `-${formatPrice(c.processingFeeAmount)}` : "—"}
                </td>
                <td className="py-1 pl-2 text-right font-semibold">{formatPrice(c.netRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {channels.length === 0 && <p className="py-6 text-center text-xs text-gray-700">{t("pages.noData")}</p>}
      </Section>

      <Section title={t("pages.financeTopItems")}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">#</th>
              <th className="py-1.5 pr-2 font-semibold">{t("common.name")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeQtySold")}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
            </tr>
          </thead>
          <tbody>
            {topItems.map((item, i) => (
              <tr key={item.name} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1 pr-2 text-gray-600">{i + 1}</td>
                <td className="py-1 pr-2 font-medium">{item.name}</td>
                <td className="py-1 pr-2 text-right">{item.totalQuantity}</td>
                <td className="py-1 pl-2 text-right font-semibold">{formatPrice(item.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {topItems.length === 0 && <p className="py-6 text-center text-xs text-gray-700">{t("pages.noData")}</p>}
      </Section>

      <Section title={t("pages.financeByCategory")}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">{t("pages.financeCategory")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeOrders")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeQtySold")}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.categoryId ?? "none"} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1 pr-2 font-medium">
                  {c.categoryId ? c.categoryName : t("pages.financeUncategorized")}
                </td>
                <td className="py-1 pr-2 text-right">{c.orderItemCount}</td>
                <td className="py-1 pr-2 text-right">{c.totalQuantity}</td>
                <td className="py-1 pl-2 text-right font-semibold">{formatPrice(c.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <p className="py-6 text-center text-xs text-gray-700">{t("pages.noData")}</p>}
      </Section>

      <Section title={t("pages.financeByShift")}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">{t("pages.financeCashier")}</th>
              <th className="py-1.5 pr-2 font-semibold">{t("pages.financeShiftPeriod")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeOrders")}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((sh) => (
              <tr key={sh.shiftId ?? "unassigned"} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1 pr-2 font-medium">
                  {sh.shiftId ? sh.staffName : t("pages.financeUnassigned")}
                  {sh.shiftId && (
                    <span className="ml-1 text-[10px] text-gray-600">
                      (
                      {sh.isOpen
                        ? t("pages.financeShiftStatusOpen")
                        : t("pages.financeShiftStatusClosed")}
                      )
                    </span>
                  )}
                </td>
                <td className="py-1 pr-2 text-gray-700">
                  {sh.openedAt ? (
                    <>
                      {formatDateTime(sh.openedAt)}
                      {sh.closedAt ? ` – ${formatDateTime(sh.closedAt)}` : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-1 pr-2 text-right">{sh.orderCount}</td>
                <td className="py-1 pl-2 text-right font-semibold">{formatPrice(sh.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shifts.length === 0 && <p className="py-6 text-center text-xs text-gray-700">{t("pages.noData")}</p>}
      </Section>

      <Section
        title={t("pages.financeScheduleShiftBlock")}
        note={t("pages.financeScheduleShiftOverlapNote")}
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">{t("pages.financeScheduleShiftBlock")}</th>
              <th className="py-1.5 pr-2 font-semibold">{t("common.date")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeOrders")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
              <th className="py-1.5 pl-2 font-semibold">{t("pages.financeStaffOnDuty")}</th>
            </tr>
          </thead>
          <tbody>
            {scheduleShiftRows
              .filter((r) => r.orderCount > 0)
              .map((r, i) => (
                <tr key={i} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1 pr-2 font-medium">{r.name}</td>
                  <td className="py-1 pr-2">{r.date}</td>
                  <td className="py-1 pr-2 text-right">{r.orderCount}</td>
                  <td className="py-1 pr-2 text-right font-semibold">{formatPrice(r.revenue)}</td>
                  <td className="py-1 pl-2 text-[10px] text-gray-700">
                    {r.staffOnDuty.map((s) => s.name).join(", ") || "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {scheduleShiftRows.filter((r) => r.orderCount > 0).length === 0 && (
          <p className="py-6 text-center text-xs text-gray-700">{t("pages.noData")}</p>
        )}
      </Section>

      <Section title={t("pages.financeDaily")}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">{t("common.date")}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">{t("pages.financeRevenue")}</th>
            </tr>
          </thead>
          <tbody>
            {summary.buckets.map((b) => (
              <tr key={b.date} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1 pr-2">{b.date}</td>
                <td className="py-1 pl-2 text-right font-semibold">{formatPrice(b.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.buckets.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-700">{t("pages.noData")}</p>
        )}
      </Section>

      <Section title={t("pages.financeWaste")}>
        {wasteReasons.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
            {wasteReasons.map((r) => (
              <span
                key={r.reason + r.label}
                className="rounded-full border border-gray-300 px-2 py-1 text-gray-800"
              >
                {r.label}: {formatPrice(r.totalValue)}
              </span>
            ))}
          </div>
        )}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">{t("waste.table.date")}</th>
              <th className="py-1.5 pr-2 font-semibold">{t("waste.table.item")}</th>
              <th className="py-1.5 pr-2 font-semibold">{t("waste.table.reason")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("waste.table.quantity")}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t("waste.table.unitCost")}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">{t("waste.table.totalValue")}</th>
            </tr>
          </thead>
          <tbody>
            {wasteEntries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200 break-inside-avoid">
                <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                <td className="py-1 pr-2 font-medium">{entry.itemName}</td>
                <td className="py-1 pr-2">{entry.reasonLabel}</td>
                <td className="py-1 pr-2 text-right">
                  {entry.quantity} {entry.unit}
                </td>
                <td className="py-1 pr-2 text-right">{formatPrice(entry.unitCostSnapshot)}</td>
                <td className="py-1 pl-2 text-right font-semibold">{formatPrice(entry.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {wasteEntries.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-700">
            {t("waste.empty") || "No waste recorded for this period"}
          </p>
        )}
      </Section>
    </PrintReportShell>
  );
}
