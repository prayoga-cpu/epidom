import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { createCSVResponse } from "@/lib/utils/csv-export";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { supplierFilterSchema } from "@/lib/validation/inventory.schemas";

/**
 * GET /api/stores/[id]/suppliers/export
 * Export suppliers to CSV format
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
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
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const filters = supplierFilterSchema.parse(filterParams);

    // Get CSV data from service
    const csv = await supplierService.exportSuppliers(storeId, filters);

    // Return CSV file using utility
    return createCSVResponse(csv, "suppliers-export");
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/suppliers/export",
      context: { storeId, userId: session?.user?.id },
    });
  }
}
