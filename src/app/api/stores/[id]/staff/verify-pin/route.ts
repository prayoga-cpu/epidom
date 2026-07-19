import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { compare } from "bcryptjs";
import { verifyStaffPinSchema } from "@/lib/validation/operations.schemas";

/**
 * POST /api/stores/[id]/staff/verify-pin
 * Verify a staff PIN and return the matched staff + their open shift.
 * Used by the POS tablet gate to identify which server is using the tablet.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = verifyStaffPinSchema.safeParse(body);
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

    const { staffId, pin } = parsed.data;

    const staff = await prisma.staffMember.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, role: true, pin: true, storeId: true, isActive: true },
    });

    if (!staff || staff.storeId !== storeId || !staff.isActive) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found"),
        { status: 404 }
      );
    }

    if (staff.pin) {
      if (!pin || pin === "") {
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "PIN required"), {
          status: 401,
        });
      }
      const valid = await compare(pin, staff.pin);
      if (!valid) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Incorrect PIN"), {
          status: 401,
        });
      }
    }

    // Look up open shift for this staff member
    const openShift = await prisma.shift.findFirst({
      where: { storeId, staffMemberId: staff.id, closedAt: null },
      select: { id: true },
    });

    return NextResponse.json(
      createSuccessResponse({
        staff: { id: staff.id, name: staff.name, role: staff.role },
        shift: openShift ?? null,
      })
    );
  },
  { requireStoreAuth: true, rateLimitEndpoint: "/api/stores/[id]/staff/verify-pin" }
);
