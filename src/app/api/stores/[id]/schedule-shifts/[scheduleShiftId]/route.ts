import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { updateScheduleShiftSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";

export const dynamic = "force-dynamic";

/** PATCH /api/stores/[id]/schedule-shifts/[scheduleShiftId] — manager/owner only. */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { scheduleShiftId } = params as { scheduleShiftId: string };
    const existing = await prisma.scheduleShift.findUnique({ where: { id: scheduleShiftId } });
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift block not found"),
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateScheduleShiftSchema.safeParse(body);
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

    const scheduleShift = await prisma.scheduleShift.update({
      where: { id: scheduleShiftId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.startTime !== undefined && { startTime: parsed.data.startTime }),
        ...(parsed.data.endTime !== undefined && { endTime: parsed.data.endTime }),
        ...(parsed.data.color !== undefined && { color: parsed.data.color || null }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      },
    });

    return NextResponse.json(createSuccessResponse({ scheduleShift }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-shifts", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/schedule-shifts/[scheduleShiftId] — manager/owner
 * only. Soft-deactivate, never hard delete: past StaffSchedule rows and
 * finance reports must keep resolving the block's name/times historically.
 */
export const DELETE = withApiHandler(
  async (_request, { storeId, params }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { scheduleShiftId } = params as { scheduleShiftId: string };
    const existing = await prisma.scheduleShift.findUnique({ where: { id: scheduleShiftId } });
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift block not found"),
        { status: 404 }
      );
    }

    await prisma.scheduleShift.update({ where: { id: scheduleShiftId }, data: { isActive: false } });

    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-shifts", requireStoreAuth: true }
);
