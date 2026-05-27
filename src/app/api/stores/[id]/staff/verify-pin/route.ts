import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { compare } from "bcryptjs";
import { z } from "zod";

const verifyPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
});

/**
 * POST /api/stores/[id]/staff/verify-pin
 * Verify a staff PIN and return the matched staff + their open shift.
 * Used by the POS tablet gate to identify which server is using the tablet.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = verifyPinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "PIN must be exactly 4 digits"),
        { status: 400 }
      );
    }

    const { pin } = parsed.data;

    const activeStaff = await prisma.staffMember.findMany({
      where: { storeId, isActive: true },
      select: { id: true, name: true, role: true, pin: true },
    });

    // Try each active staff member's bcrypt hash
    let matched: { id: string; name: string; role: string } | null = null;
    for (const member of activeStaff) {
      const valid = await compare(pin, member.pin);
      if (valid) {
        matched = { id: member.id, name: member.name, role: member.role };
        break;
      }
    }

    if (!matched) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Incorrect PIN"),
        { status: 401 }
      );
    }

    // Look up open shift for this staff member
    const openShift = await prisma.shift.findFirst({
      where: { storeId, staffMemberId: matched.id, closedAt: null },
      select: { id: true },
    });

    return NextResponse.json(
      createSuccessResponse({ staff: matched, shift: openShift ?? null })
    );
  },
  { requireStoreAuth: true, rateLimitEndpoint: "/api/stores/[id]/staff/verify-pin" }
);
