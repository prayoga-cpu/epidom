import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { manualCloseAttendanceSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/attendance/[attendanceId]/close
 *
 * Manager/owner recovery path for a stuck clock-in (staff forgot to clock
 * out, device died, etc). Appends a new CLOCK_OUT record with a required
 * correction reason rather than editing/deleting the original CLOCK_IN —
 * corrections never rewrite history, same principle as the Waste feature's
 * compensating-entry approach (see STATUS.md).
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { attendanceId } = params as { attendanceId: string };
    const body = await request.json();
    const parsed = manualCloseAttendanceSchema.safeParse(body);
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

    const openClockIn = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    });
    if (!openClockIn || openClockIn.storeId !== storeId || openClockIn.type !== "CLOCK_IN") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Open clock-in not found"),
        { status: 404 }
      );
    }

    const alreadyClosed = await prisma.attendanceRecord.findFirst({
      where: {
        storeId,
        staffMemberId: openClockIn.staffMemberId,
        type: "CLOCK_OUT",
        timestamp: { gt: openClockIn.timestamp },
      },
    });
    if (alreadyClosed) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "This clock-in is already closed"),
        { status: 409 }
      );
    }

    const { notes, timestamp } = parsed.data;
    const closeAt = timestamp ? new Date(timestamp) : new Date();
    if (closeAt <= openClockIn.timestamp) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "The correction time must be after the clock-in time"
        ),
        { status: 400 }
      );
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        storeId,
        staffMemberId: openClockIn.staffMemberId,
        staffScheduleId: openClockIn.staffScheduleId,
        type: "CLOCK_OUT",
        timestamp: closeAt,
        notes,
      },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json(createSuccessResponse({ record }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/close", requireStoreAuth: true }
);
