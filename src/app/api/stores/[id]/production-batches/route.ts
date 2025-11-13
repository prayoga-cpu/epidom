import { NextRequest, NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import {
  createProductionBatchFormSchema,
  productionBatchFilterSchema,
} from "@/lib/validation/production.schemas";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/production-batches
 * Get all production batches for a store with optional filtering
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

    const { store } = result;
    const storeId = store.id;

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
    const batchesData = await productionBatchService.getProductionBatches(storeId, filters);

    return NextResponse.json(createSuccessResponse(batchesData), { status: 200 });
  } catch (error) {
    console.error("Error fetching production batches:", error);

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
        error instanceof Error ? error.message : "Failed to fetch production batches"
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/production-batches
 * Start production - creates a new production batch and deducts materials
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

    const { store } = result;
    const storeId = store.id;
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
    console.error("Error starting production:", error);

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
      if (error.message.includes("Insufficient materials")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 400 }
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
        error instanceof Error ? error.message : "Failed to start production"
      ),
      { status: 500 }
    );
  }
}
