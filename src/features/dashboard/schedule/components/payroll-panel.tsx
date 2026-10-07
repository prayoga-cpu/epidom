"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api/client";
import type { PayrollReport, StaffPayrollWithName } from "@/lib/attendance/fetch-payroll";
import type { PayType } from "@/lib/attendance/payroll";
import { PayrollBreakdown } from "./payroll-breakdown";
import { differenceTone, useHoursFormat } from "./use-hours-format";

const PAY_TYPE_KEY: Record<PayType, string> = {
  HOURLY: "pages.payrollPayTypeHourly",
  MONTHLY: "pages.payrollPayTypeMonthly",
  SALES: "pages.payrollPayTypeSales",
  NONE: "pages.payrollNotSet",
};

interface PayrollPanelProps {
  storeId: string;
  /** Business-local "YYYY-MM-DD" bounds, shared with the Log and Hours tabs' filter. */
  from: string;
  to: string;
  staffId: string | null;
}

/**
 * The Schedule page's Salary tab (owner only): what each staff member has
 * earned over the filter's range, one row each, expanding to the breakdown
 * and the days behind it. Read-only — rates and allowances are edited on the
 * Staff page's Contract card.
 */
export function PayrollPanel({ storeId, from, to, staffId }: PayrollPanelProps) {
  const { t } = useI18n();
  const { duration, signedDuration, money } = useHoursFormat();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payroll", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<PayrollReport>(`/stores/${storeId}/payroll`, {
        from,
        to,
        ...(staffId && { staffId }),
      }),
  });

  const staff = data?.staff ?? [];
  const currency = data?.currency ?? "IDR";
  const sum = (pick: (p: StaffPayrollWithName) => number | null) =>
    staff.reduce((total, p) => total + (pick(p) ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-4">
          <div>
            <p className="text-muted-foreground text-sm">{t("pages.payrollTotalLabel")}</p>
            <p className="text-2xl font-bold tabular-nums">{data ? money(data.total, currency) : "—"}</p>
            <p className="text-muted-foreground text-xs">
              {t("pages.payrollStaffCount").replace("{count}", String(staff.length))}
            </p>
          </div>
          <p className="text-muted-foreground max-w-md text-xs">{t("pages.payrollRatesNote")}</p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">{t("pages.payrollDesc")}</p>

      <Card>
        <CardContent className="pt-4">
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.staff")}</TableHead>
                  <TableHead>{t("pages.payrollColumnPay")}</TableHead>
                  <TableHead className="text-right">{t("pages.payrollColumnDays")}</TableHead>
                  <TableHead className="text-right">{t("pages.payrollColumnHours")}</TableHead>
                  <TableHead className="text-right">{t("pages.payrollColumnBase")}</TableHead>
                  <TableHead className="text-right">{t("pages.payrollColumnAllowances")}</TableHead>
                  <TableHead className="text-right">{t("pages.payrollColumnOvertime")}</TableHead>
                  <TableHead className="text-right">{t("pages.payrollColumnTotal")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-destructive text-center">
                      {t("common.error")}
                    </TableCell>
                  </TableRow>
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground text-center">
                      {t("pages.payrollEmpty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((p) => {
                    const open = expanded === p.staffMemberId;
                    return (
                      <Fragment key={p.staffMemberId}>
                        <TableRow>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{t(PAY_TYPE_KEY[p.payType])}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.daysPresent}
                            {p.absentDays > 0 && (
                              <span className="text-destructive block text-xs">
                                {t("pages.payrollAbsentDays").replace("{count}", String(p.absentDays))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {duration(p.workedMinutes)}
                            {p.differenceMinutes !== 0 && (
                              <span className={`block text-xs ${differenceTone(p.differenceMinutes)}`}>
                                {signedDuration(p.differenceMinutes)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.base.amount !== null ? (
                              money(p.base.amount, currency)
                            ) : (
                              <span className="text-muted-foreground">{t("pages.payrollNotSet")}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.allowances.length > 0 ? money(p.allowanceTotal, currency) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.overtime.amount !== null && p.overtime.hours > 0 ? (
                              money(p.overtime.amount, currency)
                            ) : p.overtimeMinutes > 0 ? (
                              <span className="text-muted-foreground text-xs">{duration(p.overtimeMinutes)}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {money(p.total, currency)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              aria-expanded={open}
                              aria-label={`${open ? t("pages.payrollHideDetails") : t("pages.payrollShowDetails")} — ${p.name}`}
                              onClick={() => setExpanded(open ? null : p.staffMemberId)}
                            >
                              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={9} className="bg-muted/30">
                              <div className="max-w-2xl py-2">
                                <PayrollBreakdown payroll={p} currency={currency} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
              {staff.length > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">
                      {t("pages.payrollColumnTotal")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(sum((p) => p.base.amount), currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(sum((p) => p.allowanceTotal), currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(sum((p) => p.overtime.amount), currency)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money(data?.total ?? 0, currency)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
