import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { recipeService } from "@/lib/services/recipe.service";
import { subscriptionService } from "@/lib/services";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { recipeFilterSchema } from "@/lib/validation/inventory.schemas";

/**
 * GET /api/stores/[id]/recipes/export
 * Export recipes to CSV format
 */
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan - Advanced Reports (Export) is PRO/ENTERPRISE only
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

    const filters = recipeFilterSchema.omit({ skip: true, take: true }).parse(filterParams);

    // Get CSV data from service
    const csv = await recipeService.exportRecipes(storeId!, {
      ...filters,
      skip: 0,
      take: 10000, // Export all matching records
    });

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="recipes-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/recipes/export", requireStoreAuth: true }
);
