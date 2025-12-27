import { NextRequest, NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { updateSupplierSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { z } from "zod";

/**
 * GET /api/stores/[id]/suppliers/[supplierId]
 * Get a single supplier by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
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

    const { id: storeId, supplierId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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

    return NextResponse.json(createSuccessResponse(supplier), { status: 200 });
  } catch (error) {
    const { id: storeId, supplierId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/suppliers/[supplierId]",
      context: { storeId, supplierId, userId: session?.user?.id },
    });
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
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
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

    const { id: storeId, supplierId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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
    });

    return NextResponse.json(createSuccessResponse(supplier), { status: 200 });
  } catch (error) {
    const { id: storeId, supplierId } = await params;
    return handleApiError(error, {
      endpoint: "PATCH /api/stores/[id]/suppliers/[supplierId]",
      context: { storeId, supplierId, userId: session?.user?.id },
    });
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
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
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

    const { id: storeId, supplierId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Delete supplier via service
    await supplierService.deleteSupplier(supplierId, storeId);

    return NextResponse.json(createSuccessResponse({ message: "Supplier deleted successfully" }), {
      status: 200,
    });
  } catch (error) {
    const { id: storeId, supplierId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/suppliers/[supplierId]",
      context: { storeId, supplierId, userId: session?.user?.id },
    });
  }
}
