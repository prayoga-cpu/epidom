import { NextRequest, NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/product-usage
 *
 * Get product usage for a specific store based on user's subscription plan.
 * Returns current product count, limit, and whether user can create more products.
 *
 * Used by UI to check limits before rendering create product button.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, userId: verifiedUserId } = result;
    const { id: storeId } = await params;

    // Get product usage check
    const productCheck = await subscriptionService.canCreateProduct(verifiedUserId, storeId);

    // Convert Infinity to null for JSON serialization (unlimited plans)
    const limit = productCheck.limit === Infinity ? null : productCheck.limit;

    return NextResponse.json(
      createSuccessResponse({
        current: productCheck.current,
        limit: limit,
        canCreateMore: productCheck.allowed,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API] Product usage error:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error.message || "Failed to get product usage"
      ),
      { status: 500 }
    );
  }
}

