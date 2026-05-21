import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { productService } from "@/lib/services/product.service";
import { subscriptionService } from "@/lib/services";
import { createCSVResponse } from "@/lib/utils/csv-export";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";

// Validation schema for filtering products
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
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan - Advanced Reports (Export) is OPERATIONS/ENTERPRISE only
    const hasAccess = await subscriptionService.hasAdvancedReportsAccess(userId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Advanced Reports (Export) is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          { feature: "advancedReports", upgradeRequired: true }
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
    const csv = await productService.exportProducts(storeId!, filters);

    // Return CSV file using utility
    return createCSVResponse(csv, `products-export-${new Date().toISOString().split("T")[0]}`);
  },
  { rateLimitEndpoint: "/api/stores/[id]/products/export", requireStoreAuth: true }
);
