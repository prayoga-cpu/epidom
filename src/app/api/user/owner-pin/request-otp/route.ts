/**
 * POST /api/user/owner-pin/request-otp
 *
 * "Forgot PIN" step 1: emails a 6-digit one-time code to the account
 * owner's own email so they can reset their Owner PIN from a shared device
 * where a staff persona is active. Whoever is holding the device can
 * trigger this, but only someone with access to the owner's inbox can
 * complete the reset — the same trust model as any password-reset email.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { sendOwnerPinResetOtpEmail } from "@/lib/services/email.service";

export const dynamic = "force-dynamic";

const OTP_IDENTIFIER_PREFIX = "owner-pin-otp:";
const OTP_TTL_MS = 10 * 60 * 1000;

export const POST = withApiHandler(
  async (_request, { userId }) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Account not found"), {
        status: 404,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const identifier = `${OTP_IDENTIFIER_PREFIX}${userId}`;
    const now = new Date();

    // Replace any previous outstanding code for this user.
    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({
      data: {
        identifier,
        value: otp,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        createdAt: now,
        updatedAt: now,
      },
    });

    await sendOwnerPinResetOtpEmail(user.email, user.name ?? null, otp);

    // Don't leak the address in the response beyond what the UI already
    // knows the user's own account email to be.
    return NextResponse.json(createSuccessResponse({ sent: true, email: user.email }));
  },
  { rateLimitEndpoint: "/api/user/owner-pin/request-otp" }
);
