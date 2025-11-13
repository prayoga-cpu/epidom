import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { subscriptionService } from "@/lib/services";
import { createCSVResponse } from "@/lib/utils/csv-export";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

// Validation schema for filtering products (same as main route)
const productFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z
    .enum(["name", "sku", "currentStock", "costPrice", "sellingPrice", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/stores/[id]/products/export
 * Export products to CSV format
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Check subscription plan - Advanced Reports (Export) is PRO/ENTERPRISE only
    // Note: This check is separate from store access verification because it's a feature-level
    // permission that applies to the user, not the store. Even if the user has access to the store,
    // they need the appropriate subscription plan to use export features.
    const hasAccess = await subscriptionService.hasAdvancedReportsAccess(verifiedUserId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Advanced Reports (Export) is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          {
            feature: "advancedReports",
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const filters = productFilterSchema.parse(filterParams);

    // Get CSV data from service
    const csv = await productService.exportProducts(storeId, filters);

    // Return CSV file using utility
    return createCSVResponse(csv, "products-export");
  } catch (error) {
    console.error("Error exporting products:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid filter parameters",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to export products"
      ),
      { status: 500 }
    );
  }
}
