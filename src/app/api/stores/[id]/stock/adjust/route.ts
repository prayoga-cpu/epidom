import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { materialService } from "@/lib/services/material.service";
import { stockAdjustmentSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { recordAction } from "@/lib/audit/record";

/**
 * POST /api/stores/[id]/stock/adjust
 *
 * Manual stock adjustment endpoint.
 * Creates a stock movement record and updates material/product stock.
 *
 * Recorded as COMPENSATE_ONLY in the audit catalogue (src/lib/audit/catalog.ts
 * "stock.adjust"): stock is a ledger, so a revert would leave currentStock
 * disagreeing with the sum of StockMovement rows. Recording it still matters —
 * it is what lets an operator find who made the adjustment and points them at
 * the correct remedy (post a compensating adjustment) instead of offering a
 * broken Revert button.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    // Parse and validate request body
    const body = await request.json();
    const input = stockAdjustmentSchema.parse(body);

    // Adjust stock via material service
    const result = await materialService.adjustStock(storeId!, {
      materialId: input.materialId,
      productId: input.productId,
      adjustmentType: input.adjustmentType,
      quantity: Number(input.quantity),
      reason: input.reason,
      notes: input.notes,
      referenceId: input.referenceId,
    });

    const itemName = result.material?.name ?? result.product?.name ?? "Unknown item";

    await recordAction({
      actionType: "stock.adjust",
      storeId: storeId!,
      targetId: result.material?.id ?? result.product?.id,
      payload: {
        storeId: storeId!,
        itemType: result.material ? "MATERIAL" : "PRODUCT",
        itemId: (result.material?.id ?? result.product?.id)!,
        itemName,
        quantityDelta: result.movement.quantity.toString(),
        balanceAfter: result.movement.balanceAfter?.toString() ?? null,
        reason: input.reason ?? null,
      },
    });

    return NextResponse.json(createSuccessResponse(result), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/stock/adjust", requireStoreAuth: true }
);
