import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { reportAbsenceSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { reverseGeocode } from "@/lib/attendance/geocode";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/attendance/absence
 *
 * Records an ABSENCE event — no selfie required, independent of any open
 * clock-in (a staff member reporting they won't be in today never "clocked
 * in" in the first place).
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = reportAbsenceSchema.safeParse(body);
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
    const { staffId, pin, notes, latitude, longitude } = parsed.data;

    const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || staff.storeId !== storeId || !staff.isActive) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found or inactive"),
        { status: 404 }
      );
    }

    if (staff.pin) {
      if (!pin) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "PIN required"), {
          status: 401,
        });
      }
      const pinValid = await compare(pin, staff.pin);
      if (!pinValid) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Incorrect PIN"), {
          status: 401,
        });
      }
    }

    const locationLabel =
      latitude !== undefined && longitude !== undefined
        ? await reverseGeocode(latitude, longitude)
        : null;

    const record = await prisma.attendanceRecord.create({
      data: {
        storeId,
        staffMemberId: staffId,
        type: "ABSENCE",
        notes,
        latitude,
        longitude,
        locationLabel,
      },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json(createSuccessResponse({ record }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/absence", requireStoreAuth: true }
);
