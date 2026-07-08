import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { createIngredientSchema, materialFilterSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { operationsGuard } from "@/lib/auth/require-feature";

/**
 * GET /api/stores/[id]/materials
 *
 * Get all materials for a store with optional filtering.
 * Query params: search, category, supplierId, stockStatus, sortBy, sortOrder, skip, take
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filters = materialFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      stockStatus: searchParams.get("stockStatus") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || 0,
      take: searchParams.get("take") || 50,
    });

    // Get materials with filters
    // storeId is guaranteed to be defined because requireStoreAuth is true
    const result = await materialService.getMaterials(storeId!, filters);

    return NextResponse.json(createSuccessResponse(result));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/materials",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/materials
 *
 * Create a new material for a store.
 */
export const POST = withApiHandler(
  async (request, { storeId, userId }) => {
    const gate = await operationsGuard(userId, "Materials management");
    if (gate) return gate;

    // Parse and validate request body
    const body = await request.json();
    const input = createIngredientSchema.parse({ ...body, storeId });

    // Create material via service
    const material = await materialService.createMaterial(input);

    return NextResponse.json(createSuccessResponse(material), {
      status: 201,
    });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/materials",
    requireStoreAuth: true,
  }
);
