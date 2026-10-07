import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import {
  fetchHoursReport,
  getStoreHoursSettings,
  resolveReportRange,
} from "@/lib/attendance/fetch-hours-report";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/attendance/hours?from&to&staffId?
 *
 * The Hours tab: one row per staff member per business day with what they
 * worked, what they were expected to work (published roster, else the store
 * standard) and the difference — see fetch-hours-report.ts. `from`/`to` are
 * business-local "YYYY-MM-DD" keys (an ISO datetime is still accepted).
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const now = new Date();
    const settings = await getStoreHoursSettings(storeId!);
    const range = resolveReportRange(searchParams, settings.timeZone, now);
    if (!range) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }
    const { fromKey, toKey } = range;

    const { rows, missingClockOuts } = await fetchHoursReport({
      storeId: storeId!,
      fromKey,
      toKey,
      staffId,
      settings,
      now,
    });

    const staffIds = [
      ...new Set([...rows.map((r) => r.staffMemberId), ...missingClockOuts.map((m) => m.staffMemberId)]),
    ];
    const staff = await prisma.staffMember.findMany({
      where: { storeId, id: { in: staffIds } },
      select: { id: true, name: true, role: true },
    });
    const staffMap = new Map(staff.map((s) => [s.id, s]));

    return NextResponse.json(
      createSuccessResponse({
        from: fromKey,
        to: toKey,
        standardWorkMinutesPerDay: settings.standardWorkMinutesPerDay,
        days: rows.map((row) => ({ ...row, staff: staffMap.get(row.staffMemberId) ?? null })),
        missingClockOuts: missingClockOuts.map((m) => ({
          ...m,
          staff: staffMap.get(m.staffMemberId) ?? null,
        })),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/hours", requireStoreAuth: true }
);
