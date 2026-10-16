/**
 * GET /api/stores/[id]/finance/labour
 *
 * Labour cost for the range: what the Schedule page's Salary tab says each
 * staff member earned — base pay, allowances and paid overtime (fetchPayroll)
 * — so Finance's labour number and the payroll are always the same number.
 * With overtime approval on, overtime still waiting for approval is reported
 * (`pendingOvertimeMinutes`) but not costed until approved.
 *
 * Query params: from, to
 *
 * Manager/owner only, like Cash Reconciliation. Each person's pay rate and
 * cost are the OWNER's only (as on the Salary tab): a manager gets the totals —
 * labour cost, labour %, prime cost — and hours, with `payHidden: true`.
 */
import { NextResponse } from "next/server";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { canSeeStaffPay } from "@/lib/auth/require-owner-only";
import { getStoreHoursSettings } from "@/lib/attendance/fetch-hours-report";
import { fetchPayroll } from "@/lib/attendance/fetch-payroll";
import { reportDayRange } from "@/lib/finance/report-filters";
import { labourFromPayroll } from "@/lib/finance/insights";

export const dynamic = "force-dynamic";

/** Same ceiling as the Salary tab (resolveReportRange): a year, with slack. */
const MAX_RANGE_DAYS = 400;

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;
    const gate = await requireFinanceReportAccessApi(storeId!);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to < from ||
      (to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }

    // The days the report asked for — not `getBusinessDateKey(to)`, which for
    // any store east of UTC turns 23:59:59Z on the last day into the next
    // day and adds a day of salary. Each worked day itself is still the
    // business-local day its clock-in fell on.
    const { fromKey, toKey } = reportDayRange(from, to);
    const [settings, payHidden] = await Promise.all([
      getStoreHoursSettings(storeId!),
      canSeeStaffPay(storeId!).then((canSee) => !canSee),
    ]);
    const payroll = await fetchPayroll({ storeId: storeId!, fromKey, toKey, settings, now });
    const report = labourFromPayroll(payroll.staff);

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        ...report,
        overtimeRequiresApproval: payroll.overtimeRequiresApproval,
        hasCommission: payroll.staff.some((p) => p.base.kind === "sales"),
        // Sorted by name when hidden: the report's own order (by cost) would
        // still rank everyone's pay.
        rows: payHidden
          ? report.rows
              .map((row) => ({
                ...row,
                payRate: null,
                base: null,
                allowances: null,
                overtimePay: null,
                cost: null,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : report.rows,
        payHidden,
        // Clock-ins never closed: their hours are missing from the cost.
        missingClockOuts: report.incompleteDays,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/labour", requireStoreAuth: true }
);
