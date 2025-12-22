import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse } from "@/types/api/responses";
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
 * Auto-creates business if not exists.
 *
 * All business logic handled by service:
 * - Auto-create business if missing
 * - Check subscription status
 * - Check store limit
 * - Create store in transaction
 *
 * Errors thrown by service are automatically mapped to HTTP responses:
 * - SubscriptionInactiveError → 403
 * - StoreLimitExceededError → 403 with upgradeRequired: true
 * - ConflictError → 409 (store name exists)
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const input = createStoreSchema.parse(body);

    // Single service call - all logic handled internally
    const store = await businessService.createStoreForUser(userId, input);

    return NextResponse.json(createSuccessResponse(store), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores",
  }
);
