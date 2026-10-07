import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireOwnerWithoutStaffPersonaApi } from "@/lib/auth/require-owner-only";
import { requireStoreFeatureApi } from "@/lib/auth/require-store-feature";
import { getStoreHoursSettings, resolveReportRange } from "@/lib/attendance/fetch-hours-report";
import { fetchPayroll } from "@/lib/attendance/fetch-payroll";
import { payrollQuerySchema } from "@/lib/validation/attendance.schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/payroll?from&to&staffId?
 *
 * The Schedule page's Salary tab: what every staff member has earned over the
 * range — base pay, allowances, overtime — with the day-by-day hours behind
 * it. Owner only — what each person is paid is not a manager's to read — and
 * with no non-owner persona active on the device for any store.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const ownerGuard = await requireOwnerWithoutStaffPersonaApi(storeId!);
    if (ownerGuard) return ownerGuard;
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
    if (!range) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }

    const report = await fetchPayroll({
      storeId: storeId!,
      fromKey: range.fromKey,
      toKey: range.toKey,
      staffId: query.data.staffId,
      settings,
      now,
    });

    return NextResponse.json(createSuccessResponse(report));
  },
  { rateLimitEndpoint: "/api/stores/[id]/payroll", requireStoreAuth: true }
);
