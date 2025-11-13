import { NextRequest, NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { updateProductionBatchSchema } from "@/lib/validation/production.schemas";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/production-batches/[batchId]
 * Get a single production batch by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
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

    const { id: storeId, batchId } = resolvedParams;

    // Get batch from service
    const batch = await productionBatchService.getProductionBatchById(batchId);

    if (!batch) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Production batch not found"),
        { status: 404 }
      );
    }

    // Verify batch belongs to store
    if (batch.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Production batch does not belong to this store"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  } catch (error) {
    console.error("Error fetching production batch:", error);

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to fetch production batch"
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]/production-batches/[batchId]
 * Update production batch details (non-status fields)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
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

    const { id: storeId, batchId } = resolvedParams;
    const body = await request.json();

    // Validate request body
    const validatedData = updateProductionBatchSchema.parse(body);

    // Update batch via service
    const batch = await productionBatchService.updateProductionBatch(
      batchId,
      storeId,
      validatedData
    );

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  } catch (error) {
    console.error("Error updating production batch:", error);

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
        error instanceof Error ? error.message : "Failed to update production batch"
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/production-batches/[batchId]
 * Delete production batch (only if status is PLANNED)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
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

    const { id: storeId, batchId } = resolvedParams;

    // Delete batch via service
    await productionBatchService.deleteProductionBatch(batchId, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: "Production batch deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting production batch:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (error.message.includes("Can only delete planned batches")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete production batch"
      ),
      { status: 500 }
    );
  }
}
