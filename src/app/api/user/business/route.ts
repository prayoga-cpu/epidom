/**
 * User Business API Routes
 *
 * Handles business CRUD operations for authenticated users.
 * Each user can have one business which can contain multiple stores.
 */

import { NextResponse } from "next/server";
import { businessService, subscriptionService } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { createBusinessSchema, updateBusinessSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

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
 * Also provisions a default Store if one doesn't exist yet,
 * and returns storeId so the onboarding can use storefront APIs immediately.
 */
export const PATCH = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const input = updateBusinessSchema.parse(body);

    const business = await businessService.upsertBusiness(userId, input);

    // Ensure a default Store exists for this business (bypass subscription check
    // here — the first store is provisioned automatically during onboarding).
    let store = await prisma.store.findFirst({
      where: { businessId: business.id },
      select: { id: true },
    });
    if (!store) {
      try {
        logger.info("Creating default store for business", { businessId: business.id, name: input.name });
        store = await prisma.store.create({
          data: { businessId: business.id, name: input.name || "My Store" },
          select: { id: true },
        });
        logger.info("Created default store", { storeId: store.id });
      } catch (err) {
        logger.error("Failed to create default store", err, { businessId: business.id, input });
        return NextResponse.json(createErrorResponse(ApiErrorCode.DATABASE_ERROR, "Failed to create store"), { status: 500 });
      }
    }

    // Provision free OPERATIONS subscription so the user has full access immediately.
    try {
      await subscriptionService.activateFree(userId);
    } catch (err) {
      logger.error("Failed to activate free subscription", err, { userId });
      return NextResponse.json(createErrorResponse(ApiErrorCode.SUBSCRIPTION_INACTIVE, "Failed to activate subscription"), { status: 500 });
    }

    return NextResponse.json(createSuccessResponse({ ...business, storeId: store.id }));
  },
  {
    rateLimitEndpoint: "/api/user/business",
  }
);
