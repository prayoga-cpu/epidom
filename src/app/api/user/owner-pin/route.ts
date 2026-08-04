/**
 * GET/POST /api/user/owner-pin
 *
 * The account owner's 4-digit PIN — protects "switch back to Owner" on a
 * shared device once any staff PIN account exists (see
 * /api/stores/[id]/staff and /api/user/verify-owner-pin). Stored on Business
 * (one owner per business, shared across all of that owner's stores).
 */
import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request, { userId }) => {
    const business = await businessService.getBusinessByUserId(userId);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }
    return NextResponse.json(createSuccessResponse({ hasPin: !!business.ownerPin }));
  },
  { rateLimitEndpoint: "/api/user/owner-pin" }
);

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
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    const pinHash = await hash(pin, 10);
    await prisma.business.update({
      where: { id: business.id },
      data: { ownerPin: pinHash },
    });

    return NextResponse.json(createSuccessResponse({ hasPin: true }));
  },
  { rateLimitEndpoint: "/api/user/owner-pin" }
);
