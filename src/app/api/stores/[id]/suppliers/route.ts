import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { createSupplierSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { z } from "zod";

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
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getServerSession(authOptions);
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
    const result = await supplierService.getSuppliers(storeId, filters);

    return NextResponse.json(createSuccessResponse(result), { status: 200 });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/suppliers",
      context: { storeId, userId: session?.user?.id },
    });
  }
}

/**
 * POST /api/stores/[id]/suppliers
 * Create a new supplier
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getServerSession(authOptions);
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
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "POST /api/stores/[id]/suppliers",
      context: { storeId, userId: session?.user?.id },
    });
  }
}
