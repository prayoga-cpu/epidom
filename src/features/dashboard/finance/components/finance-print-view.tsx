"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { PrintReportShell } from "@/features/dashboard/shared/components/print-report-shell";
import { mapPaymentMethodLabel } from "@/features/pos/lib/order-status-display";
import { orderSourceLabel } from "@/features/pos/lib/order-channel";
import {
  averageTicket,
  buildPnlLines,
  itemMarginTotals,
  scheduleBlockSubtotals,
  sharePct,
  sumColumns,
  topItemsBreakdown,
} from "@/lib/finance/report-totals";
import type { ExpenseCategoryTotal } from "@/lib/finance/expenses";
import type {
  CategoryRow,
  CategoryTotals,
  ChannelRow,
  DepartmentRow,
  ItemMarginRow,
  PaymentMethodRow,
  ScheduleShiftBucketRow,
  ScheduleShiftTotals,
  ShiftRow,
  SummaryData,
  TopItem,
  TopItemsTotals,
  WasteReasonRow,
} from "../finance-types";

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

interface FinancePrintViewProps {
  storeName: string;
  currency: string;
  from: string;
  to: string;
  /** true when from/to are a till session's exact datetimes, not whole days. */
  isExactWindow?: boolean;
  generatedAt: string;
  filters: {
    staffLabel: string | null;
    categoryId: string | null;
    categoryName: string | null;
    department: string | null;
    channel?: string | null;
    paymentMethod?: string | null;
  };
  summary: Omit<SummaryData, "from" | "to">;
  channels: ChannelRow[];
  paymentMethods: PaymentMethodRow[];
  topItems: TopItem[];
  topItemsTotals: TopItemsTotals | null;
  itemMargin: ItemMarginRow[];
  categories: CategoryRow[];
  categoryTotals: CategoryTotals | null;
  departments: DepartmentRow[];
  // Store-owner-authored label for the optional second product line (e.g.
  // "Hair Salon") — null when the feature isn't enabled, in which case a
  // CUSTOM bucket can't occur anyway.
  customDepartmentLabel?: string | null;
  shifts: ShiftRow[];
  scheduleShiftRows: ScheduleShiftBucketRow[];
  scheduleTotals: ScheduleShiftTotals | null;
  wasteReasons: WasteReasonRow[];
  wasteEntries: WasteEntryRow[];
  wasteTotals: { count: number; value: number };
  /** null when the expenses ledger couldn't be read. */
  expenses: { total: number; byCategory: ExpenseCategoryTotal[] } | null;
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

interface PrintColumn {
  label: string;
  align?: "right";
}

/** One report table: header, rows, and the total/subtotal lines underneath. */
function PrintTable({
  columns,
  rows,
  foot = [],
  empty,
}: {
  columns: PrintColumn[];
  rows: { key: string; cells: ReactNode[] }[];
  foot?: { key: string; cells: ReactNode[]; strong?: boolean }[];
  empty: string;
}) {
  const cellClass = (i: number) =>
    `py-1 ${i === columns.length - 1 ? "pl-2" : "pr-2"} ${columns[i]?.align === "right" ? "text-right" : ""}`;
  return (
    <>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left">
            {columns.map((c, i) => (
              <th key={c.label + i} className={`${cellClass(i)} py-1.5 font-semibold`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="break-inside-avoid border-b border-gray-200">
              {row.cells.map((cell, i) => (
                <td key={i} className={cellClass(i)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && foot.length > 0 && (
          <tfoot>
            {foot.map((row, index) => (
              <tr
                key={row.key}
                className={`break-inside-avoid ${index === 0 ? "border-t-2 border-black" : ""} ${row.strong ? "font-bold" : "font-semibold text-gray-800"}`}
              >
                {row.cells.map((cell, i) => (
                  <td key={i} className={cellClass(i)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
      {rows.length === 0 && <p className="py-6 text-center text-xs text-gray-700">{empty}</p>}
    </>
  );
}

/**
 * Full-detail PDF companion to the Finance Reports dashboard (via browser
 * print → Save as PDF, same convention as Attendance/Schedule/Order History).
 * Every table carries the same totals as the screen — they come from the same
 * report-totals.ts helpers — and the P&L prints as a statement that adds up.
 */
export function FinancePrintView({
  storeName,
  currency,
  from,
  to,
  isExactWindow,
  generatedAt,
  filters,
  summary,
  channels,
  paymentMethods,
  topItems,
  topItemsTotals,
  itemMargin,
  categories,
  categoryTotals,
  departments,
  customDepartmentLabel,
  shifts,
  scheduleShiftRows,
  scheduleTotals,
  wasteReasons,
  wasteEntries,
  wasteTotals,
  expenses,
}: FinancePrintViewProps) {
  const { t, formatDateTime } = useI18n();
  // formatPrice: no-op passthrough — every Order-derived figure is already
  // literal in the owner's own currency (or pre-converted server-side by
  // finance/print/page.tsx). formatCost: real IDR->owner-currency conversion,
  // for the waste rows, which come from raw WasteEntry records.
  const { formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const formatCost = (value: number | null | undefined) => formatPriceRaw(value);
  const noData = t("pages.noData");

  const departmentLabel = (department: DepartmentRow["department"]) =>
    department === "KITCHEN"
      ? t("common.departmentKitchen")
      : department === "BAR"
        ? t("common.departmentBar")
        : department === "CUSTOM"
          ? (customDepartmentLabel ?? t("common.departmentUnassigned"))
          : t("common.departmentUnassigned");

  const period = isExactWindow
    ? `${formatDateTime(from)} – ${formatDateTime(to)}`
    : `${from} – ${to}`;
  const filterChips: string[] = [`${t("pos.printReport.filterDateRange")}: ${period}`];
  if (filters.staffLabel) {
    filterChips.push(`${t("pos.printReport.filterStaff")}: ${filters.staffLabel}`);
  }
  if (filters.categoryId === "none") {
    filterChips.push(`${t("pages.financeCategory")}: ${t("pages.financeUncategorized")}`);
  } else if (filters.categoryName) {
    filterChips.push(`${t("pages.financeCategory")}: ${filters.categoryName}`);
  }
  if (filters.department) {
    filterChips.push(
      `${t("common.department")}: ${departmentLabel(filters.department === "none" ? null : (filters.department as DepartmentRow["department"]))}`
    );
  }
  if (filters.channel) {
    filterChips.push(`${t("pages.financeChannel")}: ${orderSourceLabel(t, filters.channel)}`);
  }
  if (filters.paymentMethod) {
    filterChips.push(
      `${t("pages.financePaymentMethod")}: ${mapPaymentMethodLabel(t, filters.paymentMethod)}`
    );
  }

  const summaryTiles: [string, string][] = [
    [t("pages.financeRevenue"), formatPrice(summary.revenue)],
    [t("pages.financeNetSales"), formatPrice(summary.netSales)],
    [
      t("pages.financeGrossProfit"),
      `${formatPrice(summary.grossProfit)} (${summary.grossMarginPct.toFixed(1)}%)`,
    ],
    [t("pages.financeNetProfit"), formatPrice(summary.netProfit)],
    [t("pages.financeOrders"), String(summary.orderCount)],
    [t("pages.financeAvgTicket"), formatPrice(averageTicket(summary.revenue, summary.orderCount))],
  ];

  const pct = (value: number) =>
    summary.netSales > 0 ? `${sharePct(value, summary.netSales).toFixed(1)}%` : "";
  const pnlLines = buildPnlLines(summary);
  const profitAfterExpenses =
    expenses != null ? Math.round((summary.netProfit - expenses.total) * 100) / 100 : null;

  const dailyTotals = sumColumns(summary.buckets, [
    "orderCount",
    "revenue",
    "discountAmount",
    "refundAmount",
    "taxCollected",
    "netSales",
  ] as const);
  const channelTotals = sumColumns(channels, [
    "orderCount",
    "revenue",
    "refundAmount",
    "taxAmount",
    "commissionAmount",
    "processingFeeAmount",
    "netRevenue",
  ] as const);
  const paymentTotals = sumColumns(paymentMethods, ["orderCount", "revenue"] as const);
  const items = topItemsBreakdown(topItems, topItemsTotals);
  const margin = itemMarginTotals(itemMargin);
  const departmentTotals = sumColumns(departments, ["totalQuantity", "totalRevenue"] as const);
  const shiftTotals = sumColumns(shifts, ["orderCount", "revenue"] as const);
  const blockSubtotals = scheduleBlockSubtotals(scheduleShiftRows);
  const itemsSubtotal = categoryTotals?.totalRevenue ?? 0;
  const orderAdjustments = Math.round((summary.revenue - itemsSubtotal) * 100) / 100;

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
            <div key={label} className="break-inside-avoid rounded border border-gray-300 p-2">
              <p className="text-[9px] tracking-wide text-gray-600 uppercase">{label}</p>
              <p className="text-sm font-semibold text-black">{value}</p>
            </div>
          ))}
        </div>
        {summary.awaitingPaymentCount > 0 && (
          <p className="mt-2 text-[10px] text-gray-700">
            {t("pages.financeAwaitingPaymentNote")
              .replace("{count}", String(summary.awaitingPaymentCount))
              .replace("{amount}", formatPrice(summary.awaitingPaymentAmount))}
          </p>
        )}
      </Section>

      <Section title={t("pages.financePLStatement")}>
        <table className="w-full max-w-xl border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 font-semibold" />
              <th className="py-1.5 pr-2 text-right font-semibold">{currency}</th>
              <th className="py-1.5 pl-2 text-right font-semibold">
                {t("pages.financePctOfNetSales")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pnlLines.map((line) => (
              <tr
                key={line.key}
                className={`break-inside-avoid ${line.kind === "line" ? "text-gray-700" : "border-t border-black font-semibold"} ${line.kind === "total" ? "border-t-2 font-bold" : ""}`}
              >
                <td className={`py-1 pr-2 ${line.kind === "line" ? "pl-3" : ""}`}>
                  {t(line.labelKey)}
                </td>
                <td className="py-1 pr-2 text-right">{formatPrice(line.value)}</td>
                <td className="py-1 pl-2 text-right text-gray-600">{pct(line.value)}</td>
              </tr>
            ))}
            {expenses != null && (
              <>
                <tr className="text-gray-700">
                  <td className="py-1 pr-2 pl-3">{t("pages.financeOperatingExpenses")}</td>
                  <td className="py-1 pr-2 text-right">{formatPrice(-expenses.total)}</td>
                  <td className="py-1 pl-2 text-right text-gray-600">{pct(-expenses.total)}</td>
                </tr>
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-1 pr-2">{t("pages.financeProfitAfterExpenses")}</td>
                  <td className="py-1 pr-2 text-right">{formatPrice(profitAfterExpenses)}</td>
                  <td className="py-1 pl-2 text-right text-gray-600">
                    {pct(profitAfterExpenses ?? 0)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-gray-600">
          {t("pages.financePnlMemo")
            .replace("{serviceCharge}", formatPrice(summary.serviceCharge))
            .replace("{delivery}", formatPrice(summary.deliveryFee))}
        </p>
      </Section>

      {expenses != null && expenses.byCategory.length > 0 && (
        <Section title={t("pages.financeExpenses")}>
          <PrintTable
            columns={[
              { label: t("pages.financeCategory") },
              { label: t("pages.financeEntries"), align: "right" },
              { label: t("pages.financeAmount"), align: "right" },
            ]}
            rows={expenses.byCategory.map((c) => ({
              key: c.category,
              cells: [
                t(`pages.financeExpenseCategory.${c.category}`),
                c.count,
                formatPrice(c.amount),
              ],
            }))}
            foot={[
              {
                key: "total",
                strong: true,
                cells: [
                  t("pages.financeTotal"),
                  expenses.byCategory.reduce((sum, c) => sum + c.count, 0),
                  formatPrice(expenses.total),
                ],
              },
            ]}
            empty={noData}
          />
        </Section>
      )}

      <Section title={t("pages.financeDaily")}>
        <PrintTable
          columns={[
            { label: t("common.date") },
            { label: t("pages.financeOrders"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: t("pages.financeDiscount"), align: "right" },
            { label: t("pages.financeRefund"), align: "right" },
            { label: t("pages.financeTax"), align: "right" },
            { label: t("pages.financeNetSales"), align: "right" },
            { label: t("pages.financeAvgTicket"), align: "right" },
          ]}
          rows={summary.buckets.map((b) => ({
            key: b.date,
            cells: [
              b.date,
              b.orderCount,
              formatPrice(b.revenue),
              formatPrice(b.discountAmount),
              formatPrice(b.refundAmount),
              formatPrice(b.taxCollected),
              formatPrice(b.netSales),
              formatPrice(averageTicket(b.revenue, b.orderCount)),
            ],
          }))}
          foot={[
            {
              key: "total",
              strong: true,
              cells: [
                t("pages.financeTotal"),
                dailyTotals.orderCount,
                formatPrice(dailyTotals.revenue),
                formatPrice(dailyTotals.discountAmount),
                formatPrice(dailyTotals.refundAmount),
                formatPrice(dailyTotals.taxCollected),
                formatPrice(dailyTotals.netSales),
                formatPrice(averageTicket(dailyTotals.revenue, dailyTotals.orderCount)),
              ],
            },
          ]}
          empty={noData}
        />
      </Section>

      <Section title={t("pages.financeChannels")}>
        <PrintTable
          columns={[
            { label: t("pages.financeChannel") },
            { label: t("pages.financeOrders"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: t("pages.financeRefund"), align: "right" },
            { label: t("pages.financeTax"), align: "right" },
            { label: t("pages.financeCommission"), align: "right" },
            { label: t("pages.financeProcessingFee"), align: "right" },
            { label: t("pages.financeNetRevenue"), align: "right" },
          ]}
          rows={channels.map((c) => ({
            key: c.source,
            cells: [
              c.label,
              c.orderCount,
              formatPrice(c.revenue),
              formatPrice(c.refundAmount),
              formatPrice(c.taxAmount),
              c.commissionPct > 0
                ? `${formatPrice(c.commissionAmount)} (${c.commissionPct}%)`
                : "—",
              formatPrice(c.processingFeeAmount),
              formatPrice(c.netRevenue),
            ],
          }))}
          foot={[
            {
              key: "total",
              strong: true,
              cells: [
                t("pages.financeTotal"),
                channelTotals.orderCount,
                formatPrice(channelTotals.revenue),
                formatPrice(channelTotals.refundAmount),
                formatPrice(channelTotals.taxAmount),
                formatPrice(channelTotals.commissionAmount),
                formatPrice(channelTotals.processingFeeAmount),
                formatPrice(channelTotals.netRevenue),
              ],
            },
          ]}
          empty={noData}
        />
      </Section>

      <Section title={t("pages.financePaymentMethod")} note={t("pages.financePaymentsHint")}>
        <PrintTable
          columns={[
            { label: t("pages.financePaymentMethod") },
            { label: t("pages.financePayments"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: "%", align: "right" },
          ]}
          rows={paymentMethods.map((m) => ({
            key: m.paymentMethod,
            cells: [
              mapPaymentMethodLabel(t, m.paymentMethod),
              m.orderCount,
              formatPrice(m.revenue),
              `${m.percentOfTotal}%`,
            ],
          }))}
          foot={[
            {
              key: "total",
              strong: true,
              cells: [
                t("pages.financeTotal"),
                paymentTotals.orderCount,
                formatPrice(paymentTotals.revenue),
                "100%",
              ],
            },
          ]}
          empty={noData}
        />
      </Section>

      <Section title={t("pages.financeTopItems")}>
        <PrintTable
          columns={[
            { label: "#" },
            { label: t("common.name") },
            { label: t("pages.financeQtySold"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: t("pages.financeShare"), align: "right" },
          ]}
          rows={topItems.map((item, i) => ({
            key: item.name,
            cells: [
              i + 1,
              item.name,
              item.totalQuantity,
              formatPrice(item.totalRevenue),
              items.all ? `${sharePct(item.totalRevenue, items.all.totalRevenue)}%` : "",
            ],
          }))}
          foot={[
            {
              key: "shown",
              cells: [
                "",
                t("pages.financeTopSubtotal").replace("{count}", String(items.shown.itemCount)),
                items.shown.totalQuantity,
                formatPrice(items.shown.totalRevenue),
                items.all ? `${sharePct(items.shown.totalRevenue, items.all.totalRevenue)}%` : "",
              ],
            },
            ...(items.other
              ? [
                  {
                    key: "other",
                    cells: [
                      "",
                      t("pages.financeOtherItems").replace(
                        "{count}",
                        String(items.other.itemCount)
                      ),
                      items.other.totalQuantity,
                      formatPrice(items.other.totalRevenue),
                      items.all
                        ? `${sharePct(items.other.totalRevenue, items.all.totalRevenue)}%`
                        : "",
                    ],
                  },
                ]
              : []),
            ...(items.all
              ? [
                  {
                    key: "all",
                    strong: true,
                    cells: [
                      "",
                      t("pages.financeAllItems"),
                      items.all.totalQuantity,
                      formatPrice(items.all.totalRevenue),
                      "100%",
                    ],
                  },
                ]
              : []),
          ]}
          empty={noData}
        />
      </Section>

      <Section title={t("pages.financeItemMargin")} note={t("pages.financeUnknownCostHint")}>
        <PrintTable
          columns={[
            { label: t("common.name") },
            { label: t("pages.financeQtySold"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: t("pages.financeCost"), align: "right" },
            { label: t("pages.financeMarginAmount"), align: "right" },
            { label: t("pages.financeMargin"), align: "right" },
          ]}
          rows={itemMargin.map((item) => ({
            key: item.name,
            cells: [
              item.name,
              item.totalQuantity,
              formatPrice(item.totalRevenue),
              item.totalCost != null ? formatPrice(item.totalCost) : "—",
              item.margin != null ? formatPrice(item.margin) : "—",
              item.marginPct != null ? `${item.marginPct}%` : "—",
            ],
          }))}
          foot={[
            {
              key: "costed",
              strong: true,
              cells: [
                t("pages.financeCostedTotal"),
                "",
                formatPrice(margin.costedRevenue),
                formatPrice(margin.totalCost),
                formatPrice(margin.margin),
                `${margin.marginPct}%`,
              ],
            },
            ...(margin.uncostedCount > 0
              ? [
                  {
                    key: "uncosted",
                    cells: [
                      t("pages.financeUncostedItems").replace(
                        "{count}",
                        String(margin.uncostedCount)
                      ),
                      "",
                      formatPrice(margin.uncostedRevenue),
                      "—",
                      "—",
                      "—",
                    ],
                  },
                ]
              : []),
          ]}
          empty={noData}
        />
      </Section>

      <Section title={t("pages.financeByCategory")} note={t("pages.financeOrderAdjustmentsHint")}>
        <PrintTable
          columns={[
            { label: t("pages.financeCategory") },
            { label: t("pages.financeOrders"), align: "right" },
            { label: t("pages.financeQtySold"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: t("pages.financeShare"), align: "right" },
          ]}
          rows={categories.map((c) => ({
            key: c.categoryId ?? "none",
            cells: [
              c.categoryId ? c.categoryName : t("pages.financeUncategorized"),
              c.orderCount,
              c.totalQuantity,
              formatPrice(c.totalRevenue),
              `${sharePct(c.totalRevenue, itemsSubtotal)}%`,
            ],
          }))}
          foot={
            categoryTotals
              ? [
                  {
                    key: "subtotal",
                    cells: [
                      t("pages.financeItemsSubtotal"),
                      categoryTotals.orderCount,
                      categoryTotals.totalQuantity,
                      formatPrice(categoryTotals.totalRevenue),
                      "100%",
                    ],
                  },
                  {
                    key: "adjustments",
                    cells: [
                      t("pages.financeOrderAdjustments"),
                      "",
                      "",
                      formatPrice(orderAdjustments),
                      "",
                    ],
                  },
                  {
                    key: "revenue",
                    strong: true,
                    cells: [
                      t("pages.financeRevenue"),
                      summary.orderCount,
                      "",
                      formatPrice(summary.revenue),
                      "",
                    ],
                  },
                ]
              : []
          }
          empty={noData}
        />
      </Section>

      {departments.length > 0 && (
        <Section title={t("pages.financeDepartmentSplit")}>
          <PrintTable
            columns={[
              { label: t("common.department") },
              { label: t("pages.financeQtySold"), align: "right" },
              { label: t("pages.financeRevenue"), align: "right" },
              { label: t("pages.financeShare"), align: "right" },
            ]}
            rows={departments.map((d) => ({
              key: d.department ?? "unassigned",
              cells: [
                departmentLabel(d.department),
                d.totalQuantity,
                formatPrice(d.totalRevenue),
                `${sharePct(d.totalRevenue, departmentTotals.totalRevenue)}%`,
              ],
            }))}
            foot={[
              {
                key: "total",
                strong: true,
                cells: [
                  t("pages.financeItemsSubtotal"),
                  departmentTotals.totalQuantity,
                  formatPrice(departmentTotals.totalRevenue),
                  "100%",
                ],
              },
            ]}
            empty={noData}
          />
        </Section>
      )}

      <Section title={t("pages.financeByShift")}>
        <PrintTable
          columns={[
            { label: t("pages.financeCashier") },
            { label: t("pages.financeShiftPeriod") },
            { label: t("pages.financeOrders"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
            { label: t("pages.financeAvgTicket"), align: "right" },
          ]}
          rows={shifts.map((sh) => ({
            key: sh.shiftId ?? "unassigned",
            cells: [
              sh.shiftId
                ? `${sh.staffName} (${sh.isOpen ? t("pages.financeShiftStatusOpen") : t("pages.financeShiftStatusClosed")})`
                : t("pages.financeUnassigned"),
              sh.openedAt
                ? `${formatDateTime(sh.openedAt)}${sh.closedAt ? ` – ${formatDateTime(sh.closedAt)}` : ""}`
                : "—",
              sh.orderCount,
              formatPrice(sh.revenue),
              formatPrice(averageTicket(sh.revenue, sh.orderCount)),
            ],
          }))}
          foot={[
            {
              key: "total",
              strong: true,
              cells: [
                t("pages.financeTotal"),
                "",
                shiftTotals.orderCount,
                formatPrice(shiftTotals.revenue),
                formatPrice(averageTicket(shiftTotals.revenue, shiftTotals.orderCount)),
              ],
            },
          ]}
          empty={noData}
        />
      </Section>

      <Section
        title={t("pages.financeScheduleShiftBlock")}
        note={t("pages.financeScheduleShiftOverlapNote")}
      >
        <PrintTable
          columns={[
            { label: t("pages.financeScheduleShiftBlock") },
            { label: t("pages.financeActiveDays"), align: "right" },
            { label: t("pages.financeOrders"), align: "right" },
            { label: t("pages.financeRevenue"), align: "right" },
          ]}
          rows={blockSubtotals.map((b) => ({
            key: b.scheduleShiftId,
            cells: [b.name, b.activeDays, b.orderCount, formatPrice(b.revenue)],
          }))}
          foot={
            scheduleTotals
              ? [
                  {
                    key: "outside",
                    cells: [
                      t("pages.financeOutsideBlocks"),
                      "",
                      scheduleTotals.outsideOrderCount,
                      formatPrice(scheduleTotals.outsideRevenue),
                    ],
                  },
                  {
                    key: "all",
                    strong: true,
                    cells: [
                      t("pages.financeAllOrdersOnce"),
                      "",
                      scheduleTotals.orderCount,
                      formatPrice(scheduleTotals.revenue),
                    ],
                  },
                ]
              : []
          }
          empty={noData}
        />
        <div className="mt-3">
          <PrintTable
            columns={[
              { label: t("pages.financeScheduleShiftBlock") },
              { label: t("common.date") },
              { label: t("pages.financeOrders"), align: "right" },
              { label: t("pages.financeRevenue"), align: "right" },
              { label: t("pages.financeStaffOnDuty") },
            ]}
            rows={scheduleShiftRows
              .filter((r) => r.orderCount > 0)
              .map((r) => ({
                key: `${r.scheduleShiftId}:${r.date}`,
                cells: [
                  r.name,
                  r.date,
                  r.orderCount,
                  formatPrice(r.revenue),
                  r.staffOnDuty.map((s) => s.name).join(", ") || "—",
                ],
              }))}
            empty={noData}
          />
        </div>
      </Section>

      <Section title={t("pages.financeWaste")}>
        {wasteReasons.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
            {wasteReasons.map((r) => (
              <span
                key={r.reason + r.label}
                className="rounded-full border border-gray-300 px-2 py-1 text-gray-800"
              >
                {r.label}: {formatCost(r.totalValue)}
              </span>
            ))}
          </div>
        )}
        <PrintTable
          columns={[
            { label: t("waste.table.date") },
            { label: t("waste.table.item") },
            { label: t("waste.table.reason") },
            { label: t("waste.table.quantity"), align: "right" },
            { label: t("waste.table.unitCost"), align: "right" },
            { label: t("waste.table.totalValue"), align: "right" },
          ]}
          rows={wasteEntries.map((entry) => ({
            key: entry.id,
            cells: [
              formatDateTime(entry.createdAt),
              entry.itemName,
              entry.reasonLabel,
              `${entry.quantity} ${entry.unit}`,
              formatCost(entry.unitCostSnapshot),
              formatCost(entry.totalValue),
            ],
          }))}
          foot={[
            {
              key: "total",
              strong: true,
              cells: [
                t("pages.financeTotal"),
                wasteTotals.count > wasteEntries.length
                  ? t("pages.financeShowingEntries")
                      .replace("{shown}", String(wasteEntries.length))
                      .replace("{total}", String(wasteTotals.count))
                  : "",
                "",
                "",
                "",
                formatCost(wasteTotals.value),
              ],
            },
          ]}
          empty={t("waste.empty") || "No waste recorded for this period"}
        />
      </Section>
    </PrintReportShell>
  );
}
