import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { clockOutSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { reverseGeocode } from "@/lib/attendance/geocode";
import { isStaffAuthenticated } from "@/lib/attendance/verify-staff-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/attendance/clock-out
 *
 * Pairs with the staff member's latest open CLOCK_IN. There is no "open
 * shift" row to update — a CLOCK_OUT is simply a new record; pairing happens
 * on read (see src/lib/attendance/hours-aggregation.ts).
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = clockOutSchema.safeParse(body);
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
    const { staffId, pin, selfieUrl, latitude, longitude } = parsed.data;

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

    const lastClockIn = await prisma.attendanceRecord.findFirst({
      where: { storeId, staffMemberId: staffId, type: "CLOCK_IN" },
      orderBy: { timestamp: "desc" },
    });
    if (!lastClockIn) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Staff member is not clocked in"),
        { status: 409 }
      );
    }
    const alreadyClosed = await prisma.attendanceRecord.findFirst({
      where: {
        storeId,
        staffMemberId: staffId,
        type: "CLOCK_OUT",
        timestamp: { gt: lastClockIn.timestamp },
      },
    });
    if (alreadyClosed) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Staff member is not clocked in"),
        { status: 409 }
      );
    }

    const locationLabel =
      latitude !== undefined && longitude !== undefined
        ? await reverseGeocode(latitude, longitude)
        : null;

    const record = await prisma.attendanceRecord.create({
      data: {
        storeId,
        staffMemberId: staffId,
        staffScheduleId: lastClockIn.staffScheduleId,
        type: "CLOCK_OUT",
        selfieUrl,
        latitude,
        longitude,
        locationLabel,
      },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json(createSuccessResponse({ record }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/clock-out", requireStoreAuth: true }
);
