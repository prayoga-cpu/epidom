import { NextRequest, NextResponse } from "next/server";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * DELETE /api/stores/[id]/suppliers/bulk
 * Bulk delete suppliers (hard delete)
 * WARNING: This will permanently delete suppliers and cascade delete related records
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, userId: verifiedUserId } = result;
    const storeId = store.id;

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    // Note: This check is separate from store access verification because it's a feature-level
    // permission that applies to the user, not the store. Even if the user has access to the store,
    // they need the appropriate subscription plan to use supplier management features.
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(verifiedUserId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          {
            feature: "supplierManagement",
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }
    const body = await request.json();

    // Validate request body
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete suppliers via service
    const deleteResult = await supplierService.bulkDeleteSuppliers(validatedData.ids, storeId);

    return NextResponse.json(
      createSuccessResponse({
        message: "Suppliers deleted successfully",
        deletedCount: deleteResult.deletedCount
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error bulk deleting suppliers:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid input data",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("do not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete suppliers"
      ),
      { status: 500 }
    );
  }
}
