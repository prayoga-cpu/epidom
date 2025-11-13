import { NextRequest, NextResponse } from "next/server";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { createSupplierSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

// Validation schema for filtering suppliers
const supplierFilterSchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["name", "contactPerson", "email", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * GET /api/stores/[id]/suppliers
 * Get all suppliers for a store with optional filtering
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || "0",
      take: searchParams.get("take") || "50",
    };

    const filters = supplierFilterSchema.parse(filterParams);

    // Get suppliers from service
    const suppliersData = await supplierService.getSuppliers(storeId, filters);

    return NextResponse.json(createSuccessResponse(suppliersData), { status: 200 });
  } catch (error) {
    console.error("Error fetching suppliers:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid filter parameters",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to fetch suppliers"
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/suppliers
 * Create a new supplier
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const validatedData = createSupplierSchema.parse({ ...body, storeId });

    // Create supplier via service
    const supplier = await supplierService.createSupplier({
      storeId,
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

    return NextResponse.json(createSuccessResponse(supplier), { status: 201 });
  } catch (error) {
    console.error("Error creating supplier:", error);

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
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to create supplier"
      ),
      { status: 500 }
    );
  }
}
