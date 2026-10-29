import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { adjustStockRecorded } from "@/lib/services/stock-adjust.service";
import { stockAdjustmentSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * POST /api/stores/[id]/stock/adjust
 *
 * Manual stock adjustment endpoint.
 * Creates a stock movement record and updates material/product stock, and
 * records the "stock.adjust" audit action (see adjustStockRecorded).
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    // Parse and validate request body
    const body = await request.json();
    const input = stockAdjustmentSchema.parse(body);

    const result = await adjustStockRecorded(storeId!, {
      materialId: input.materialId,
      productId: input.productId,
      adjustmentType: input.adjustmentType,
      quantity: Number(input.quantity),
      reason: input.reason,
      notes: input.notes,
      referenceId: input.referenceId,
    });

    return NextResponse.json(createSuccessResponse(result), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/stock/adjust", requireStoreAuth: true }
);
