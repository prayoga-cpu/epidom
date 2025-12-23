import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/product-usage
 *
 * Get product usage for a specific store based on user's subscription plan.
 * Returns current product count, limit, and whether user can create more products.
 *
 * Used by UI to check limits before rendering create product button.
 */
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
    // Get product usage check
    const productCheck = await subscriptionService.canCreateProduct(userId, storeId!);

    // Convert Infinity to null for JSON serialization (unlimited plans)
    const limit = productCheck.limit === Infinity ? null : productCheck.limit;

    return NextResponse.json(
      createSuccessResponse({
        current: productCheck.current,
        limit: limit,
        canCreateMore: productCheck.allowed,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/product-usage", requireStoreAuth: true }
);
