import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { updateSupplierSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/suppliers/[supplierId]
 * Get a single supplier by ID
 */
export const GET = withApiHandler(
  async (request, { storeId, params, userId }) => {
    const { supplierId } = params;

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

    // Get supplier from service
    const supplier = await supplierService.getSupplierById(supplierId);

    if (!supplier) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Supplier not found"), {
        status: 404,
      });
    }

    // Verify supplier belongs to store
    if (supplier.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Supplier does not belong to this store"),
        { status: 403 }
      );
    }

    return NextResponse.json(createSuccessResponse(supplier));
  },
  { rateLimitEndpoint: "/api/stores/[id]/suppliers/[supplierId]", requireStoreAuth: true }
);

/**
 * PATCH /api/stores/[id]/suppliers/[supplierId]
 * Update a supplier
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params, userId }) => {
    const { supplierId } = params;

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
    const validatedData = updateSupplierSchema.parse(body);

    // Update supplier via service
    const supplier = await supplierService.updateSupplier(supplierId, storeId!, {
      name: validatedData.name,
      contactPerson: validatedData.contactPerson,
      email: validatedData.email,
      phone: validatedData.phone,
      address: validatedData.address,
      city: validatedData.city,
      country: validatedData.country,
      notes: validatedData.notes,
    });

    return NextResponse.json(createSuccessResponse(supplier));
  },
  { rateLimitEndpoint: "/api/stores/[id]/suppliers/[supplierId]", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/suppliers/[supplierId]
 * Delete a supplier (hard delete)
 * WARNING: This will permanently delete the supplier and cascade delete related records
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params, userId }) => {
    const { supplierId } = params;

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

    // Delete supplier via service
    await supplierService.deleteSupplier(supplierId, storeId!);

    return NextResponse.json(createSuccessResponse({ message: "Supplier deleted successfully" }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/suppliers/[supplierId]", requireStoreAuth: true }
);
