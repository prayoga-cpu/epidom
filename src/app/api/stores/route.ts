import { NextResponse } from "next/server";
import { businessService, subscriptionService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores
 *
 * Get all stores for the current user's business.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    // Get user's business first
    const business = await businessService.getBusinessByUserId(userId);

    // If no business exists, return empty stores array (allows empty state UI to show)
    if (!business) {
      return NextResponse.json(createSuccessResponse([]));
    }

    // Get all stores for the business
    const stores = await businessService.getStoresByBusinessId(business.id);

    return NextResponse.json(createSuccessResponse(stores));
  },
  {
    rateLimitEndpoint: "/api/stores",
  }
);

/**
 * POST /api/stores
 *
 * Create a new store for the current user's business.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Get user's business
    let business = await businessService.getBusinessByUserId(userId);
    let businessId = business?.id;

    // If no business exists yet, auto-create one
    // This handles cases where user has subscription but missed onboarding
    if (!business) {
      // We need user name to create default business name
      // Since withApiHandler only provides userId, we could fetch user profile
      // But for simplicity/speed, we'll use a generic name or "My Business"
      // Ideally, business creation should be explicit, but this fallback improves UX
      const newBusiness = await businessService.createBusiness(userId, {
        name: "My Business",
        // Default settings will be applied by repository/service
      });
      business = newBusiness;
      businessId = newBusiness.id;
    }

    // Parse and validate request body
    const body = await request.json();
    const input = createStoreSchema.parse(body);

    // Create store via service
    // Store limit check is performed inside createStore() method
    try {
      const store = await businessService.createStore(businessId!, userId, input);
      return NextResponse.json(createSuccessResponse(store), { status: 201 });
    } catch (storeError) {
      // Handle store limit exceeded error (from service)
      if (storeError instanceof Error && storeError.message.includes("store limit")) {
        // Extract limit info from error message or check subscription again for error response
        const storeCheck = await subscriptionService.canCreateStore(userId);
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED, storeError.message, {
            current: storeCheck.current,
            limit: storeCheck.limit,
            upgradeRequired: true,
          }),
          { status: 403 }
        );
      }
      // Re-throw to be handled by withApiHandler
      throw storeError;
    }
  },
  {
    rateLimitEndpoint: "/api/stores",
  }
);
