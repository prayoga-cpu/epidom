import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { clockInSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { reverseGeocode } from "@/lib/attendance/geocode";
import { getBusinessDateKey, businessDateKeyToDate } from "@/lib/attendance/business-date";
import { isStaffAuthenticated } from "@/lib/attendance/verify-staff-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/attendance/clock-in
 *
 * Records a CLOCK_IN attendance event: verifies the staff PIN (same pattern
 * as opening a POS Shift), rejects a second open clock-in, best-effort
 * resolves today's published roster entry and reverse-geocodes the
 * coordinates, then creates the record.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = clockInSchema.safeParse(body);
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
    const { staffId, pin, selfieUrl, latitude, longitude, staffScheduleId } = parsed.data;

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

    const openClockIn = await prisma.attendanceRecord.findFirst({
      where: { storeId, staffMemberId: staffId, type: "CLOCK_IN" },
      orderBy: { timestamp: "desc" },
    });
    if (openClockIn) {
      const laterClockOut = await prisma.attendanceRecord.findFirst({
        where: {
          storeId,
          staffMemberId: staffId,
          type: "CLOCK_OUT",
          timestamp: { gt: openClockIn.timestamp },
        },
      });
      if (!laterClockOut) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.CONFLICT, "Staff member is already clocked in"),
          { status: 409 }
        );
      }
    }

    let resolvedScheduleId = staffScheduleId ?? null;
    if (!resolvedScheduleId) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { business: { select: { timezone: true } } },
      });
      const todayKey = getBusinessDateKey(new Date(), store?.business.timezone ?? "UTC");
      const todaysSchedule = await prisma.staffSchedule.findFirst({
        where: {
          storeId,
          staffMemberId: staffId,
          status: "PUBLISHED",
          date: businessDateKeyToDate(todayKey),
        },
      });
      resolvedScheduleId = todaysSchedule?.id ?? null;
    }

    const locationLabel =
      latitude !== undefined && longitude !== undefined
        ? await reverseGeocode(latitude, longitude)
        : null;

    const record = await prisma.attendanceRecord.create({
      data: {
        storeId,
        staffMemberId: staffId,
        staffScheduleId: resolvedScheduleId,
        type: "CLOCK_IN",
        selfieUrl,
        latitude,
        longitude,
        locationLabel,
      },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json(createSuccessResponse({ record }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/clock-in", requireStoreAuth: true }
);
