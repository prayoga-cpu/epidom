/**
 * User Business API Routes
 *
 * Handles business CRUD operations for authenticated users.
 * Each user can have one business which can contain multiple stores.
 */

import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createBusinessSchema, updateBusinessSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/user/business
 * Get current user's business.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    const business = await businessService.getBusinessByUserId(userId);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(business));
  },
  {
    rateLimitEndpoint: "/api/user/business",
  }
);

/**
 * POST /api/user/business
 * Create a new business for the current user.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const input = createBusinessSchema.parse(body);

    const business = await businessService.createBusiness(userId, input);

    return NextResponse.json(createSuccessResponse(business), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/user/business",
  }
);

/**
 * PATCH /api/user/business
 * Update or create (upsert) business for the current user.
 */
export const PATCH = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const input = updateBusinessSchema.parse(body);

    const business = await businessService.upsertBusiness(userId, input);

    return NextResponse.json(createSuccessResponse(business));
  },
  {
    rateLimitEndpoint: "/api/user/business",
  }
);
