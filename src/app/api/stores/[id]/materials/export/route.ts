import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { materialService } from "@/lib/services/material.service";
import { businessService, subscriptionService } from "@/lib/services";
import { materialFilterSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";

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

    // Verify user owns the business that owns this store
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found"
        ),
        { status: 404 }
      );
    }

    // Verify store belongs to business
    const store = await businessService.getStoreById(storeId);
    if (!store || store.businessId !== business.id) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "Store not found or does not belong to your business"
        ),
        { status: 404 }
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
