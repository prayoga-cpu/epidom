import { NextRequest, NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { completeProductionSchema } from "@/lib/validation/production.schemas";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * POST /api/stores/[id]/production-batches/[batchId]/complete
 * Complete a production batch and add finished products to inventory
 */
export async function POST(
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
    const { actualQuantity } = completeProductionSchema.parse(body);

    // Complete production via service
    const batch = await productionBatchService.completeProduction(batchId, storeId, actualQuantity);

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  } catch (error) {
    console.error("Error completing production:", error);

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
      if (error.message.includes("Only batches in progress can be completed")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to complete production"
      ),
      { status: 500 }
    );
  }
}
