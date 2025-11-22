import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";

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
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Get product usage check
    const productCheck = await subscriptionService.canCreateProduct(session.user.id, storeId);

    // Convert Infinity to null for JSON serialization (unlimited plans)
    const limit = productCheck.limit === Infinity ? null : productCheck.limit;

    return NextResponse.json(
      createSuccessResponse({
        current: productCheck.current,
        limit: limit,
        canCreateMore: productCheck.allowed,
      })
    );
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/product-usage",
      context: { storeId },
    });
  }
}

