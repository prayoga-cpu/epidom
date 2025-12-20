import { NextRequest, NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { z } from "zod";

/**
 * DELETE /api/stores/[id]/suppliers/bulk
 * Bulk delete suppliers (hard delete)
 * WARNING: This will permanently delete suppliers and cascade delete related records
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(session.user.id);
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

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();

    // Validate request body
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete suppliers via service
    const result = await supplierService.bulkDeleteSuppliers(validatedData.ids, storeId);

    return NextResponse.json(
      createSuccessResponse({
        message: "Suppliers deleted successfully",
        deletedCount: result.deletedCount
      }),
      { status: 200 }
    );
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/suppliers/bulk",
      context: { storeId, userId: session?.user?.id },
    });
  }
}
