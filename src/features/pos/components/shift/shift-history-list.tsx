"use client";

import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import { shiftReportPath } from "@/lib/finance/shift-report-path";
import { useShiftHistory, type ShiftHistoryItem } from "../../hooks/use-shift-history";
import { DIFFERENCE_TONE_CLASSES, differenceTone } from "../../lib/shift-summary";

const PAGE_SIZE = 10;

/**
 * The store's finished shifts, newest first, under the current one. Each row is
 * a link to that shift's full report — read-only, in a new tab, no print dialog.
 *
 * Every staff member's shifts are listed, not just the persona's: the till is the
 * store's, and "who ran Tuesday's" is exactly what a cashier at handover asks.
 */
export function ShiftHistoryList({ storeId }: { storeId: string }) {
  const { t, formatDateTime, formatTimeOnly } = useI18n();
  // Literal in the store's own currency — see ShiftStatusCard.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const [take, setTake] = useState(PAGE_SIZE);
  const history = useShiftHistory(storeId, take);

  const money = (value: string | number) => formatPriceRaw(Number(value), currency);
  const orderCountLabel = (n: number) =>
    n === 1 ? t("pos.shift.orderCountOne") : t("pos.shift.orderCount").replace("{n}", String(n));

  const toneLabel = {
    pending: null,
    balanced: t("pos.shift.differenceBalanced"),
    over: t("pos.shift.differenceOver"),
    short: t("pos.shift.differenceShort"),
  } as const;

  // Same-day shifts read "Sep 19, 10:59 PM – 11:04 PM"; an overnight one repeats
  // the date on the end so "– 2:10 AM" isn't mistaken for the same evening.
  const range = (shift: ShiftHistoryItem) => {
    const start = formatDateTime(shift.openedAt);
    if (!shift.closedAt) return start;
    const sameDay =
      new Date(shift.openedAt).toDateString() === new Date(shift.closedAt).toDateString();
    return `${start} – ${sameDay ? formatTimeOnly(shift.closedAt) : formatDateTime(shift.closedAt)}`;
  };

  const shifts = history.data?.shifts ?? [];
  const total = history.data?.total ?? 0;

  return (
    <section
      aria-label={t("pos.shift.historyTitle")}
      className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2"
    >
      <h3 className="px-1 text-sm font-semibold">{t("pos.shift.historyTitle")}</h3>

      {history.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
        </div>
      ) : history.isError && !history.data ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-muted-foreground text-sm">{t("pos.shift.historyLoadFailed")}</p>
          <Button variant="outline" className="h-11" onClick={() => history.refetch()}>
            {t("common.actions.retry")}
          </Button>
        </div>
      ) : shifts.length === 0 ? (
        <p className="text-muted-foreground px-1 py-2 text-sm">{t("pos.shift.historyEmpty")}</p>
      ) : (
        <>
          <ul className="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            {shifts.map((shift) => {
              const difference = shift.cashDifference == null ? null : Number(shift.cashDifference);
              const tone = differenceTone(difference);
              return (
                <li key={shift.id}>
                  <a
                    href={shiftReportPath(storeId, shift.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    // 56px rows: the whole row is the tap target (AGENTS.md ≥ 44px).
                    className="hover:bg-muted/50 flex min-h-14 touch-manipulation items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{range(shift)}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[shift.staffMember?.name, orderCountLabel(shift._count.orders)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {shift.closingCash != null && (
                        <p className="text-sm font-semibold tabular-nums">
                          {money(shift.closingCash)}
                        </p>
                      )}
                      {tone !== "pending" && difference !== null && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                            DIFFERENCE_TONE_CLASSES[tone]
                          )}
                        >
                          {toneLabel[tone]}
                          {tone !== "balanced" && ` ${money(Math.abs(difference))}`}
                        </span>
                      )}
                    </div>

                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Refetching a larger page keeps this list on screen (keepPreviousData),
              so the button is the only thing that changes. */}
          {shifts.length < total && (
            <Button
              variant="outline"
              className="h-11 w-full"
              disabled={history.isFetching}
              onClick={() => setTake((n) => n + PAGE_SIZE)}
            >
              {history.isFetching && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t("pos.shift.historyMore")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
