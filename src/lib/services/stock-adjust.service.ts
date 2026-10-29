import { materialService } from "@/lib/services/material.service";
import { recordAction } from "@/lib/audit/record";

export interface StockAdjustment {
  materialId?: string;
  productId?: string;
  adjustmentType: "IN" | "OUT";
  quantity: number;
  reason?: string;
  notes?: string;
  referenceId?: string;
}

/**
 * A manual stock adjustment and its audit record, as one step. Shared by
 * POST /api/stores/[id]/stock/adjust and the Claude connector's adjust_stock,
 * so an adjustment is recorded the same way whoever makes it.
 *
 * Recorded as COMPENSATE_ONLY in the audit catalogue (src/lib/audit/catalog.ts
 * "stock.adjust"): stock is a ledger, so a revert would leave currentStock
 * disagreeing with the sum of StockMovement rows. Recording it still matters —
 * it is what lets an operator find who made the adjustment and points them at
 * the correct remedy (post a compensating adjustment) instead of offering a
 * broken Revert button.
 *
 * @throws Error("Stock cannot be negative") when OUT would go below zero.
 */
export async function adjustStockRecorded(storeId: string, input: StockAdjustment) {
  const result = await materialService.adjustStock(storeId, input);

  const itemName = result.material?.name ?? result.product?.name ?? "Unknown item";

  await recordAction({
    actionType: "stock.adjust",
    storeId,
    targetId: result.material?.id ?? result.product?.id,
    payload: {
      storeId,
      itemType: result.material ? "MATERIAL" : "PRODUCT",
      itemId: (result.material?.id ?? result.product?.id)!,
      itemName,
      quantityDelta: result.movement.quantity.toString(),
      balanceAfter: result.movement.balanceAfter?.toString() ?? null,
      reason: input.reason ?? null,
    },
  });

  return result;
}
