import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * DELETE /api/stores/[id]/suppliers/bulk
 * Bulk delete suppliers (hard delete)
 * WARNING: This will permanently delete suppliers and cascade delete related records
 */
export const DELETE = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          { feature: "supplierManagement", upgradeRequired: true }
        ),
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete suppliers via service
    const result = await supplierService.bulkDeleteSuppliers(validatedData.ids, storeId!);

    return NextResponse.json(
      createSuccessResponse({
        message: "Suppliers deleted successfully",
        deletedCount: result.count,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/suppliers/bulk", requireStoreAuth: true }
);
