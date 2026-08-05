import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { staffScheduleBulkSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/staff-schedules/bulk
 *
 * The week-grid "Save" action — creates a batch of DRAFT roster entries in
 * one request. Manager/owner only.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const body = await request.json();
    const parsed = staffScheduleBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const staffIds = [...new Set(parsed.data.entries.map((e) => e.staffMemberId))];
    const staffCount = await prisma.staffMember.count({
      where: { id: { in: staffIds }, storeId },
    });
    if (staffCount !== staffIds.length) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "One or more staff members were not found"),
        { status: 404 }
      );
    }

    const schedules = await prisma.$transaction(
      parsed.data.entries.map((entry) =>
        prisma.staffSchedule.create({
          data: {
            // storeId is guaranteed to be defined because requireStoreAuth is true
            storeId: storeId!,
            staffMemberId: entry.staffMemberId,
            date: businessDateKeyToDate(entry.date),
            scheduleShiftId: entry.scheduleShiftId ?? null,
            customStartTime: entry.customStartTime ?? null,
            customEndTime: entry.customEndTime ?? null,
            isDayOff: entry.isDayOff ?? false,
            department: entry.department ?? null,
            notes: entry.notes || null,
          },
        })
      )
    );

    return NextResponse.json(createSuccessResponse({ schedules, count: schedules.length }), {
      status: 201,
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules/bulk", requireStoreAuth: true }
);
