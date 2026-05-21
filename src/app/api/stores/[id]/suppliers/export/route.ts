import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { createCSVResponse } from "@/lib/utils/csv-export";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { supplierFilterSchema } from "@/lib/validation/inventory.schemas";

/**
 * GET /api/stores/[id]/suppliers/export
 * Export suppliers to CSV format
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
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const filters = supplierFilterSchema.omit({ skip: true, take: true }).parse(filterParams);

    // Get CSV data from service
    const csv = await supplierService.exportSuppliers(storeId!, {
      ...filters,
      skip: 0,
      take: 10000, // Export all matching records
    });

    // Return CSV file using utility
    return createCSVResponse(csv, `suppliers-export-${new Date().toISOString().split("T")[0]}`);
  },
  { rateLimitEndpoint: "/api/stores/[id]/suppliers/export", requireStoreAuth: true }
);
