import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { subscriptionService } from "@/lib/services";
import { materialFilterSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/materials/export
 *
 * Export materials to CSV.
 * Query params: search, category, supplierId, stockStatus (same as list filters)
 */
export async function GET(
  request: Request,
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
    const filters = materialFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      stockStatus: searchParams.get("stockStatus") || undefined,
      sortBy: searchParams.get("sortBy") || "name",
      sortOrder: searchParams.get("sortOrder") || "asc",
      skip: 0,
      take: 10000, // Export all matching records (up to 10k)
    });

    // Generate CSV
    const csvContent = await materialService.exportMaterialsToCSV(storeId, filters);

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="materials-${storeId}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid query parameters",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    console.error("Error exporting materials:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred"
      ),
      { status: 500 }
    );
  }
}
