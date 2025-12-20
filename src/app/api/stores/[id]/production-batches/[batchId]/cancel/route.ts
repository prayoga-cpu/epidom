import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { z } from "zod";
import { cancelProductionSchema } from "@/lib/validation/production.schemas";

/**
 * POST /api/stores/[id]/production-batches/[batchId]/cancel
 * Cancel a production batch and optionally restore materials to inventory
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, batchId } = await params;
    const body = await request.json();

    // Validate request body
    const { restoreMaterials } = cancelProductionSchema.parse(body);

    // Cancel production via service
    const batch = await productionBatchService.cancelProduction(batchId, storeId, restoreMaterials);

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
      if (
        error.message.includes("Cannot cancel completed batches") ||
        error.message.includes("already cancelled")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel production" },
      { status: 500 }
    );
  }
}
