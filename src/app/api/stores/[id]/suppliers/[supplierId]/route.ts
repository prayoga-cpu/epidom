import { NextRequest, NextResponse } from "next/server";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { updateSupplierSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/suppliers/[supplierId]
 * Get a single supplier by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, userId: verifiedUserId } = result;
    const { id: storeId, supplierId } = resolvedParams;

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

    // Get supplier from service
    const supplier = await supplierService.getSupplierById(supplierId);

    if (!supplier) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Supplier not found"),
        { status: 404 }
      );
    }

    // Verify supplier belongs to store
    if (supplier.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Supplier does not belong to this store"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(supplier), { status: 200 });
  } catch (error) {
    console.error("Error fetching supplier:", error);

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to fetch supplier"
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]/suppliers/[supplierId]
 * Update a supplier
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, userId: verifiedUserId } = result;
    const { id: storeId, supplierId } = resolvedParams;

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
    const validatedData = updateSupplierSchema.parse(body);

    // Update supplier via service
    const supplier = await supplierService.updateSupplier(supplierId, storeId, {
      name: validatedData.name,
      contactPerson: validatedData.contactPerson,
      email: validatedData.email,
      phone: validatedData.phone,
      address: validatedData.address,
      city: validatedData.city,
      country: validatedData.country,
      notes: validatedData.notes,
      isActive: validatedData.isActive,
    });

    return NextResponse.json(createSuccessResponse(supplier), { status: 200 });
  } catch (error) {
    console.error("Error updating supplier:", error);

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
      // Handle specific business logic errors
      if (error.message.includes("does not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to update supplier"
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/suppliers/[supplierId]
 * Delete a supplier (hard delete)
 * WARNING: This will permanently delete the supplier and cascade delete related records
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, userId: verifiedUserId } = result;
    const { id: storeId, supplierId } = resolvedParams;

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

    // Delete supplier via service
    await supplierService.deleteSupplier(supplierId, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: "Supplier deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting supplier:", error);

    if (error instanceof Error) {
      if (error.message.includes("does not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete supplier"
      ),
      { status: 500 }
    );
  }
}
