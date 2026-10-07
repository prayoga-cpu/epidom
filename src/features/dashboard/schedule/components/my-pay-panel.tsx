"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";
import { parseLocalISO, todayLocalISO } from "@/lib/utils/date-range";
import type { StaffPayroll } from "@/lib/attendance/payroll";
import { PayrollBreakdown } from "./payroll-breakdown";
import { differenceTone, useHoursFormat } from "./use-hours-format";

interface MyPayResponse {
  fromKey: string;
  toKey: string;
  currency: string;
  payroll: StaffPayroll | null;
}

/** "YYYY-MM" shifted by whole months. */
function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

/**
 * POS My Pay: what the signed-in staff member has earned, one month at a
 * time — this month so far by default. Whose pay comes from the server's PIN
 * persona (GET /payroll/me takes no staff id), so this component never names
 * one either.
 */
export function MyPayPanel({ storeId }: { storeId: string }) {
  const { t, dateLocale } = useI18n();
  const { duration, signedDuration, money } = useHoursFormat();
  const today = todayLocalISO();
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const isCurrentMonth = month === currentMonth;
  const from = `${month}-01`;
  const to = isCurrentMonth ? today : lastDayOfMonth(month);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payroll-me", storeId, from, to],
    queryFn: () => apiClient.get<MyPayResponse>(`/stores/${storeId}/payroll/me`, { from, to }),
  });
  const payroll = data?.payroll ?? null;
  const currency = data?.currency ?? "IDR";

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label={t("pos.operational.payPrevMonth")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <p className="text-center font-semibold">
          {format(parseLocalISO(from), "MMMM yyyy", { locale: dateLocale })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={isCurrentMonth}
          aria-label={t("pos.operational.payNextMonth")}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : isError || !payroll ? (
        <p className="text-muted-foreground text-sm">{isError ? t("common.error") : t("pages.noData")}</p>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div>
                <p className="text-muted-foreground text-sm">
                  {isCurrentMonth ? t("pos.operational.payEarnedSoFar") : t("pos.operational.payEarnedMonth")}
                </p>
                <p className="text-3xl font-bold tabular-nums">{money(payroll.total, currency)}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>{t("pages.payrollDaysPresent").replace("{count}", String(payroll.daysPresent))}</span>
                <span className="tabular-nums">
                  {duration(payroll.workedMinutes)}
                  {payroll.differenceMinutes !== 0 && (
                    <span className={`ml-1 ${differenceTone(payroll.differenceMinutes)}`}>
                      ({signedDuration(payroll.differenceMinutes)})
                    </span>
                  )}
                </span>
                {payroll.absentDays > 0 && (
                  <span className="text-destructive">
                    {t("pages.payrollAbsentDays").replace("{count}", String(payroll.absentDays))}
                  </span>
                )}
              </div>
              {payroll.base.kind === "notSet" && (
                <p className="text-muted-foreground text-xs">{t("pos.operational.payNoRate")}</p>
              )}
            </CardContent>
          </Card>

          <PayrollBreakdown payroll={payroll} currency={currency} />

          <p className="text-muted-foreground text-xs">{t("pos.operational.payEstimateNote")}</p>
        </>
      )}
    </div>
  );
}
