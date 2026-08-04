/**
 * POST /api/user/verify-owner-pin
 * Verifies the account owner's PIN — used by "switch back to Owner" on a
 * shared device. On success, also clears any active staff session cookie
 * for this browser, restoring full (owner) access.
 */
import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { compare } from "bcryptjs";
import { clearStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (request, { userId }) => {
    const { pin } = await request.json();
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "PIN must be exactly 4 digits"),
        { status: 400 }
      );
    }

    const business = await businessService.getBusinessByUserId(userId);
    if (!business?.ownerPin) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "No Owner PIN set on this account"),
        { status: 400 }
      );
    }

    const valid = await compare(pin, business.ownerPin);
    if (!valid) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Incorrect PIN"), {
        status: 401,
      });
    }

    await clearStaffSession();

    return NextResponse.json(createSuccessResponse({ valid: true }));
  },
  { rateLimitEndpoint: "/api/user/verify-owner-pin" }
);
