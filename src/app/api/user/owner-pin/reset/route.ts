/**
 * POST /api/user/owner-pin/reset
 * "Forgot PIN" step 2: verifies the emailed OTP and sets a new Owner PIN.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { businessService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

const OTP_IDENTIFIER_PREFIX = "owner-pin-otp:";

export const POST = withApiHandler(
  async (request, { userId }) => {
    const { otp, newPin } = await request.json();

    if (typeof newPin !== "string" || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "PIN must be exactly 4 digits"),
        { status: 400 }
      );
    }
    if (typeof otp !== "string" || otp.length === 0) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Code is required"),
        { status: 400 }
      );
    }

    const identifier = `${OTP_IDENTIFIER_PREFIX}${userId}`;
    const verification = await prisma.verification.findFirst({ where: { identifier } });

    if (!verification || verification.value !== otp || new Date() > verification.expiresAt) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Invalid or expired code"),
        { status: 401 }
      );
    }

    const business = await businessService.getBusinessByUserId(userId);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    const pinHash = await hash(newPin, 10);
    await prisma.business.update({ where: { id: business.id }, data: { ownerPin: pinHash } });
    // Single-use: burn the code once it's been redeemed.
    await prisma.verification.delete({ where: { id: verification.id } });

    return NextResponse.json(createSuccessResponse({ hasPin: true }));
  },
  { rateLimitEndpoint: "/api/user/owner-pin/reset" }
);
