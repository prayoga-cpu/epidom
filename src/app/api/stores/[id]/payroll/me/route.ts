import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireStoreFeatureApi } from "@/lib/auth/require-store-feature";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getStoreHoursSettings, resolveReportRange } from "@/lib/attendance/fetch-hours-report";
import { fetchPayroll } from "@/lib/attendance/fetch-payroll";
import { payrollQuerySchema } from "@/lib/validation/attendance.schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/payroll/me?from&to
 *
 * POS My Pay: the signed-in staff member's own earnings for the range.
 *
 * Whose pay this is comes ONLY from the server-verified PIN persona — there
 * is no staffId param. /schedule/my-log takes a staffId off the query string
 * (a documented trust boundary for clock times); pay is more sensitive, so
 * one cashier on the owner's device can't read a coworker's by changing a
 * parameter. A linked staff account must be that same person (the staff
 * policy table already requires its PIN persona, this re-checks it).
 *
 * The range ends today at the latest: a monthly salary for a month that
 * hasn't happened yet isn't "earned so far".
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const persona = await getActiveStaffSession();
    if (!persona || persona.storeId !== storeId || persona.role === "OWNER") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Sign in as yourself to see your pay"),
        { status: 403 }
      );
    }
    const viewer = await getStoreViewer(storeId!);
    if (
      viewer.kind === "none" ||
      (viewer.kind === "staff" && viewer.staffMemberId !== persona.staffMemberId)
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Sign in as yourself to see your pay"),
        { status: 403 }
      );
    }
    const gate = await requireStoreFeatureApi(storeId!, "staffOperations", "Staff schedules");
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const query = payrollQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", query.error.flatten()),
        { status: 400 }
      );
    }
    const now = new Date();
    const settings = await getStoreHoursSettings(storeId!);
    const range = resolveReportRange(searchParams, settings.timeZone, now);
    if (!range || range.fromKey > range.todayKey) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }
    const toKey = range.toKey > range.todayKey ? range.todayKey : range.toKey;

    const report = await fetchPayroll({
      storeId: storeId!,
      fromKey: range.fromKey,
      toKey,
      staffId: persona.staffMemberId,
      settings,
      now,
    });

    return NextResponse.json(
      createSuccessResponse({
        fromKey: report.fromKey,
        toKey: report.toKey,
        currency: report.currency,
        standardWorkMinutesPerDay: report.standardWorkMinutesPerDay,
        payroll: report.staff[0] ?? null,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/payroll/me", requireStoreAuth: true }
);
