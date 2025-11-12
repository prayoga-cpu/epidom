import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;

    // Get product usage check
    const productCheck = await subscriptionService.canCreateProduct(session.user.id, storeId);

    // Convert Infinity to null for JSON serialization (unlimited plans)
    const limit = productCheck.limit === Infinity ? null : productCheck.limit;

    return NextResponse.json(
      {
        current: productCheck.current,
        limit: limit,
        canCreateMore: productCheck.allowed,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API] Product usage error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get product usage" },
      { status: 500 }
    );
  }
}

