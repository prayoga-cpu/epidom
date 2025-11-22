import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { subscriptionService } from "@/lib/services";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { recipeFilterSchema } from "@/lib/validation/inventory.schemas";


/**
 * GET /api/stores/[id]/recipes/export
 * Export recipes to CSV format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    // Check subscription plan - Advanced Reports (Export) is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasAdvancedReportsAccess(session.user.id);
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

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const filters = recipeFilterSchema.parse(filterParams);

    // Get CSV data from service
    const csv = await recipeService.exportRecipes(storeId, filters);

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="recipes-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/recipes/export",
      context: { storeId },
    });
  }
}
