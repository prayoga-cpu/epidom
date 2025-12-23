import { NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse } from "@/types/api/responses";
import {
  createProductionBatchFormSchema,
  productionBatchFilterSchema,
} from "@/lib/validation/production.schemas";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/production-batches
 * Get all production batches for a store with optional filtering
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      status: searchParams.get("status") || undefined,
      recipeId: searchParams.get("recipeId") || undefined,
      productId: searchParams.get("productId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "scheduledDate",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || "0",
      take: searchParams.get("take") || "50",
    };

    const filters = productionBatchFilterSchema.parse(filterParams);

    // Get production batches from service
    const result = await productionBatchService.getProductionBatches(storeId!, filters);

    return NextResponse.json(createSuccessResponse(result), { status: 200 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/production-batches
 * Start production - creates a new production batch and deducts materials
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();

    // Validate request body
    const validatedData = createProductionBatchFormSchema.parse(body);

    // Start production via service
    const batch = await productionBatchService.startProduction({
      storeId: storeId!,
      ...validatedData,
    });

    return NextResponse.json(createSuccessResponse(batch), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches",
    requireStoreAuth: true,
  }
);
