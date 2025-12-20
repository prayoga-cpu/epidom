import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import {
  createProductionBatchFormSchema,
  productionBatchFilterSchema,
} from "@/lib/validation/production.schemas";

/**
 * GET /api/stores/[id]/production-batches
 * Get all production batches for a store with optional filtering
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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
    const result = await productionBatchService.getProductionBatches(storeId, filters);

    return NextResponse.json(createSuccessResponse(result), { status: 200 });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/production-batches",
      context: { storeId },
    });
  }
}

/**
 * POST /api/stores/[id]/production-batches
 * Start production - creates a new production batch and deducts materials
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();

    // Validate request body
    const validatedData = createProductionBatchFormSchema.parse(body);

    // Start production via service
    const batch = await productionBatchService.startProduction({
      storeId,
      ...validatedData,
    });

    return NextResponse.json(createSuccessResponse(batch), { status: 201 });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "POST /api/stores/[id]/production-batches",
      context: { storeId },
    });
  }
}
