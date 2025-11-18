import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { z } from "zod";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, batchId } = await params;

    // Get batch from service
    const batch = await productionBatchService.getProductionBatchById(batchId);

    if (!batch) {
      return NextResponse.json({ error: "Production batch not found" }, { status: 404 });
    }

    // Verify batch belongs to store
    if (batch.storeId !== storeId) {
      return NextResponse.json(
        { error: "Production batch does not belong to this store" },
        { status: 403 }
      );
    }

    return NextResponse.json(batch, { status: 200 });
  } catch (error) {

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch production batch" },
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
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, batchId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = updateProductionBatchSchema.parse(body);

    // Update batch via service
    const batch = await productionBatchService.updateProductionBatch(
      batchId,
      storeId,
      validatedData
    );

    return NextResponse.json(batch, { status: 200 });
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update production batch" },
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
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, batchId } = await params;

    // Delete batch via service
    await productionBatchService.deleteProductionBatch(batchId, storeId);

    return NextResponse.json({ message: "Production batch deleted successfully" }, { status: 200 });
  } catch (error) {

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Can only delete planned batches")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete production batch" },
      { status: 500 }
    );
  }
}
