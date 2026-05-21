import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { materialService } from "@/lib/services/material.service";
import { subscriptionService } from "@/lib/services";
import { materialFilterSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/materials/export
 *
 * Export materials to CSV.
 * Query params: search, category, supplierId, stockStatus (same as list filters)
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
    const filters = materialFilterSchema.omit({ skip: true, take: true }).parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      stockStatus: searchParams.get("stockStatus") || undefined,
      sortBy: searchParams.get("sortBy") || "name",
      sortOrder: searchParams.get("sortOrder") || "asc",
    });

    // Generate CSV
    const csvContent = await materialService.exportMaterialsToCSV(storeId!, {
      ...filters,
      skip: 0,
      take: 10000, // Export all matching records (up to 10k)
    });

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="materials-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/materials/export", requireStoreAuth: true }
);
