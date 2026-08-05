import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { updateStaffScheduleSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";

export const dynamic = "force-dynamic";

/** PATCH /api/stores/[id]/staff-schedules/[staffScheduleId] — manager/owner only. */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { staffScheduleId } = params as { staffScheduleId: string };
    const existing = await prisma.staffSchedule.findUnique({ where: { id: staffScheduleId } });
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Schedule entry not found"),
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateStaffScheduleSchema.safeParse(body);
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

    const schedule = await prisma.staffSchedule.update({
      where: { id: staffScheduleId },
      data: {
        ...(parsed.data.scheduleShiftId !== undefined && {
          scheduleShiftId: parsed.data.scheduleShiftId,
        }),
        ...(parsed.data.customStartTime !== undefined && {
          customStartTime: parsed.data.customStartTime,
        }),
        ...(parsed.data.customEndTime !== undefined && {
          customEndTime: parsed.data.customEndTime,
        }),
        ...(parsed.data.isDayOff !== undefined && { isDayOff: parsed.data.isDayOff }),
        ...(parsed.data.department !== undefined && { department: parsed.data.department }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
      include: {
        staffMember: { select: { id: true, name: true, role: true } },
        scheduleShift: true,
      },
    });

    return NextResponse.json(createSuccessResponse({ schedule }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules", requireStoreAuth: true }
);

/** DELETE /api/stores/[id]/staff-schedules/[staffScheduleId] — manager/owner only. Draft rosters aren't financial/audit records, hard delete is fine. */
export const DELETE = withApiHandler(
  async (_request, { storeId, params }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { staffScheduleId } = params as { staffScheduleId: string };
    const existing = await prisma.staffSchedule.findUnique({ where: { id: staffScheduleId } });
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Schedule entry not found"),
        { status: 404 }
      );
    }

    await prisma.staffSchedule.delete({ where: { id: staffScheduleId } });

    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules", requireStoreAuth: true }
);
