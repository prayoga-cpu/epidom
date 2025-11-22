import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { updateProductionBatchSchema } from "@/lib/validation/production.schemas";

/**
 * GET /api/stores/[id]/production-batches/[batchId]
 * Get a single production batch by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId, batchId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Production batch does not belong to this store"),
        { status: 403 }
      );
    }

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  } catch (error) {
    const { id: storeId, batchId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/production-batches/[batchId]",
      context: { storeId, batchId },
    });
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
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId, batchId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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
    const { id: storeId, batchId } = await params;
    return handleApiError(error, {
      endpoint: "PATCH /api/stores/[id]/production-batches/[batchId]",
      context: { storeId, batchId },
    });
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
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId, batchId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Delete batch via service
    await productionBatchService.deleteProductionBatch(batchId, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: "Production batch deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    const { id: storeId, batchId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/production-batches/[batchId]",
      context: { storeId, batchId },
    });
  }
}
