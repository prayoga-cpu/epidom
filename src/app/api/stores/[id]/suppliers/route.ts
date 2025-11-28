import { NextResponse } from "next/server";
import { supplierService } from "@/lib/services/supplier.service";
import { subscriptionService } from "@/lib/services";
import { createSupplierSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

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
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
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
    const result = await supplierService.getSuppliers(storeId!, filters);

    return NextResponse.json(createSuccessResponse(result), { status: 200 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/suppliers",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/suppliers
 * Create a new supplier
 */
export const POST = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
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
      storeId: storeId!,
      name: validatedData.name,
      contactPerson: validatedData.contactPerson,
      email: validatedData.email,
      phone: validatedData.phone,
      address: validatedData.address,
      city: validatedData.city,
      country: validatedData.country,
      notes: validatedData.notes,
    });

    return NextResponse.json(createSuccessResponse(supplier), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/suppliers",
    requireStoreAuth: true,
  }
);
