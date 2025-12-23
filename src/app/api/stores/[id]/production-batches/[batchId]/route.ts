import { NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { updateProductionBatchSchema } from "@/lib/validation/production.schemas";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/production-batches/[batchId]
 * Get a single production batch by ID
 */
export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { batchId } = params;

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
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          "Production batch does not belong to this store"
        ),
        { status: 403 }
      );
    }

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches/[batchId]",
    requireStoreAuth: true,
  }
);

/**
 * PATCH /api/stores/[id]/production-batches/[batchId]
 * Update production batch details (non-status fields)
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { batchId } = params;
    const body = await request.json();

    // Validate request body
    const validatedData = updateProductionBatchSchema.parse(body);

    // Update batch via service
    const batch = await productionBatchService.updateProductionBatch(
      batchId,
      storeId!,
      validatedData
    );

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches/[batchId]",
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]/production-batches/[batchId]
 * Delete production batch (only if status is PLANNED)
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { batchId } = params;

    // Delete batch via service
    await productionBatchService.deleteProductionBatch(batchId, storeId!);

    return NextResponse.json(
      createSuccessResponse({ message: "Production batch deleted successfully" }),
      { status: 200 }
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches/[batchId]",
    requireStoreAuth: true,
  }
);
