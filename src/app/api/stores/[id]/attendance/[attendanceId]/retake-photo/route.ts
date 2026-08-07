import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { retakeAttendancePhotoSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { isStaffAuthenticated } from "@/lib/attendance/verify-staff-auth";

export const dynamic = "force-dynamic";

// How long after the original clock-in/out a staff member can swap in a
// better photo (blurry shot, eyes closed, etc). Short and tied to the
// original moment on purpose — this is a photo redo, not a way to backdate
// or fabricate a new attendance event.
const RETAKE_WINDOW_MS = 30 * 60 * 1000;

/**
 * POST /api/stores/[id]/attendance/[attendanceId]/retake-photo
 *
 * Replaces the selfie on an existing CLOCK_IN/CLOCK_OUT record — nothing
 * else about it (type, timestamp, notes) is editable through this or any
 * other endpoint; attendance records are an append-only audit trail (see the
 * /close route). This is a narrow, time-boxed exception for the photo only,
 * so within the log a retake still reads as "the same event", not a new one.
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { attendanceId } = params as { attendanceId: string };
    const body = await request.json();
    const parsed = retakeAttendancePhotoSchema.safeParse(body);
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
    const { staffId, pin, selfieUrl } = parsed.data;

    const record = await prisma.attendanceRecord.findUnique({ where: { id: attendanceId } });
    if (
      !record ||
      record.storeId !== storeId ||
      record.staffMemberId !== staffId ||
      record.type === "ABSENCE"
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Attendance record not found"),
        { status: 404 }
      );
    }

    if (Date.now() - record.timestamp.getTime() > RETAKE_WINDOW_MS) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "This record is too old to retake the photo"),
        { status: 409 }
      );
    }

    const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || staff.storeId !== storeId || !staff.isActive) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found or inactive"),
        { status: 404 }
      );
    }
    if (!(await isStaffAuthenticated(storeId!, staffId, pin, staff.pin))) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, pin ? "Incorrect PIN" : "PIN required"),
        { status: 401 }
      );
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: { selfieUrl },
    });

    return NextResponse.json(createSuccessResponse({ record: updated }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/retake-photo", requireStoreAuth: true }
);
