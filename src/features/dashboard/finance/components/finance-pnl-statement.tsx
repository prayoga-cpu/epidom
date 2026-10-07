"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { buildPnlLines, sharePct, type PnlLine } from "@/lib/finance/report-totals";
import { ReportStatus } from "./finance-report-parts";
import type { ExpensesData, SummaryData } from "../finance-types";

interface FinancePnlStatementProps {
  s: SummaryData;
  formatMoney: (value: number | null | undefined) => string;
  expenses: {
    data?: ExpensesData;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
  /** false when staff/channel/payment/till-session filters narrow the
   * statement: expenses are store-wide and whole-day, so subtracting them from
   * a filtered net profit would compare unlike with unlike. */
  expensesApply: boolean;
  /** The period-over-period badge for a summary field, when comparing. */
  renderDelta: (key: keyof SummaryData) => ReactNode;
}

function StatementRow({
  label,
  value,
  pct,
  kind,
  delta,
  indent,
}: {
  label: string;
  value: string;
  pct: string;
  kind: PnlLine["kind"];
  delta?: ReactNode;
  indent?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_3.5rem] items-baseline gap-x-3 py-1.5 ${
        kind === "line"
          ? "text-muted-foreground"
          : kind === "subtotal"
            ? "text-foreground border-t pt-2 font-semibold"
            : "text-foreground border-foreground/60 border-t-2 pt-2 text-base font-bold"
      }`}
    >
      <span className={`flex flex-wrap items-baseline gap-x-2 ${indent ? "pl-4 text-xs" : ""}`}>
        {label}
        {delta}
      </span>
      <span className={`text-right tabular-nums ${indent ? "text-xs" : ""}`}>{value}</span>
      <span className="text-muted-foreground text-right text-xs font-normal tabular-nums">
        {pct}
      </span>
    </div>
  );
}

/**
 * The P&L as an income statement that adds up: every subtotal is the line
 * above it less the deductions in between (buildPnlLines), each line also
 * shown as a share of net sales. Below net profit come the operating expenses
 * the owner records, down to profit after expenses.
 */
export function FinancePnlStatement({
  s,
  formatMoney,
  expenses,
  expensesApply,
  renderDelta,
}: FinancePnlStatementProps) {
  const { t } = useI18n();
  const pct = (value: number) =>
    s.netSales > 0 ? `${sharePct(value, s.netSales).toFixed(1)}%` : "";
  const lines = buildPnlLines(s);
  const expensesTotal = expenses.data?.total ?? 0;
  const profitAfterExpenses = Math.round((s.netProfit - expensesTotal) * 100) / 100;

  return (
    <div className="max-w-2xl space-y-4 text-sm">
      <div>
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_3.5rem] gap-x-3 pb-1 text-xs">
          <span />
          <span />
          <span className="text-right">{t("pages.financePctOfNetSales")}</span>
        </div>
        {lines.map((line) => (
          <div key={line.key}>
            <StatementRow
              label={t(line.labelKey)}
              value={formatMoney(line.value)}
              pct={pct(line.value)}
              kind={line.kind}
              delta={line.kind !== "line" ? renderDelta(line.key) : undefined}
            />
            {line.key === "grossProfit" && (
              <p className="text-muted-foreground -mt-1 pb-1 text-xs">
                {t("pages.financeMargin")}: {s.grossMarginPct.toFixed(1)}%
              </p>
            )}
          </div>
        ))}

        {!expensesApply ? (
          <p className="text-muted-foreground border-t py-3 text-xs">
            {t("pages.financeExpensesFilteredNote")}
          </p>
        ) : expenses.isLoading ? (
          <Skeleton className="my-2 h-8 w-full" />
        ) : expenses.isError ? (
          <div className="text-muted-foreground border-t py-3 text-center text-xs">
            <ReportStatus
              isError
              onRetry={expenses.refetch}
              loadingLabel=""
              errorLabel={t("pages.financeExpensesLoadError")}
              retryLabel={t("common.actions.retry")}
            />
          </div>
        ) : (
          <>
            <StatementRow
              label={t("pages.financeOperatingExpenses")}
              value={formatMoney(-expensesTotal)}
              pct={pct(-expensesTotal)}
              kind="line"
            />
            {(expenses.data?.byCategory ?? []).map((c) => (
              <StatementRow
                key={c.category}
                label={t(`pages.financeExpenseCategory.${c.category}`)}
                value={formatMoney(-c.amount)}
                pct=""
                kind="line"
                indent
              />
            ))}
            <StatementRow
              label={t("pages.financeProfitAfterExpenses")}
              value={formatMoney(profitAfterExpenses)}
              pct={pct(profitAfterExpenses)}
              kind="total"
            />
          </>
        )}
      </div>

      <div className="bg-muted/40 text-muted-foreground space-y-1 rounded-lg border p-3 text-xs">
        <p>
          {t("pages.financePnlMemo")
            .replace("{serviceCharge}", formatMoney(s.serviceCharge))
            .replace("{delivery}", formatMoney(s.deliveryFee))}
        </p>
        {s.platformCommission > 0 && <p>{t("pages.financeCommissionEstimateNote")}</p>}
        {s.awaitingPaymentCount > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            {t("pages.financeAwaitingPaymentNote")
              .replace("{count}", String(s.awaitingPaymentCount))
              .replace("{amount}", formatMoney(s.awaitingPaymentAmount))}
          </p>
        )}
        {(s.unknownCostLines ?? 0) > 0 && (
          <p>
            {t("finance.summary.unknownCost")
              .replace("{count}", String(s.unknownCostLines))
              .replace("{amount}", formatMoney(s.unknownCostRevenue ?? 0))}
          </p>
        )}
        <p>{t("pages.financeExpensesHint")}</p>
      </div>
    </div>
  );
}
