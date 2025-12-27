import { NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse } from "@/types/api/responses";
import { completeProductionSchema } from "@/lib/validation/production.schemas";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/stores/[id]/production-batches/[batchId]/complete
 * Complete a production batch and add finished products to inventory
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { batchId } = params;
    const body = await request.json();

    // Validate request body
    const { actualQuantity } = completeProductionSchema.parse(body);

    // Complete production via service
    const batch = await productionBatchService.completeProduction(
      batchId,
      storeId!,
      actualQuantity
    );

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches/[batchId]/complete",
    requireStoreAuth: true,
  }
);
