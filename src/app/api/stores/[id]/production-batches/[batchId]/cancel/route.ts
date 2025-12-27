import { NextResponse } from "next/server";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { createSuccessResponse } from "@/types/api/responses";
import { cancelProductionSchema } from "@/lib/validation/production.schemas";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/stores/[id]/production-batches/[batchId]/cancel
 * Cancel a production batch and optionally restore materials to inventory
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { batchId } = params;
    const body = await request.json();

    // Validate request body
    const { restoreMaterials } = cancelProductionSchema.parse(body);

    // Cancel production via service
    const batch = await productionBatchService.cancelProduction(
      batchId,
      storeId!,
      restoreMaterials
    );

    return NextResponse.json(createSuccessResponse(batch), { status: 200 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/production-batches/[batchId]/cancel",
    requireStoreAuth: true,
  }
);
