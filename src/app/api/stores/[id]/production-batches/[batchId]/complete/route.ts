import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { z } from "zod";
import { completeProductionSchema } from "@/lib/validation/production.schemas";

/**
 * POST /api/stores/[id]/production-batches/[batchId]/complete
 * Complete a production batch and add finished products to inventory
 */
export async function POST(
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
    const { actualQuantity } = completeProductionSchema.parse(body);

    // Complete production via service
    const batch = await productionBatchService.completeProduction(batchId, storeId, actualQuantity);

    return NextResponse.json(batch, { status: 200 });
  } catch (error) {
    console.error("Error completing production:", error);

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
      if (error.message.includes("Only batches in progress can be completed")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete production" },
      { status: 500 }
    );
  }
}
