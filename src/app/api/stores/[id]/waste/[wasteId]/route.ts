import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { wasteService } from "@/lib/services/waste.service";
import { updateWasteSchema } from "@/lib/validation/waste.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/waste/[wasteId]
 */
export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { wasteId } = params;
    const entry = await wasteService.getWasteEntryById(storeId!, wasteId);
    if (!entry) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Waste entry not found"),
        { status: 404 }
      );
    }
    return NextResponse.json(createSuccessResponse(entry));
  },
  { rateLimitEndpoint: "/api/stores/[id]/waste/[wasteId]", requireStoreAuth: true }
);

/**
 * PATCH /api/stores/[id]/waste/[wasteId]
 * Correct a waste entry — quantity/cost changes append a compensating stock
 * movement rather than rewriting history (see WasteService).
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { wasteId } = params;
    const body = await request.json();
    const input = updateWasteSchema.parse(body);

    const result = await wasteService.updateWasteEntry(storeId!, wasteId, {
      quantity: input.quantity !== undefined ? Number(input.quantity) : undefined,
      reason: input.reason,
      customReason: input.customReason,
      notes: input.notes,
      referenceId: input.referenceId,
      unitCostOverride:
        input.unitCostOverride !== undefined ? Number(input.unitCostOverride) : undefined,
    });

    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/stores/[id]/waste/[wasteId]", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/waste/[wasteId]
 * Reverses the recorded stock deduction and removes the entry; linked
 * StockMovement rows persist with wasteEntryId set to NULL.
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { wasteId } = params;
    const result = await wasteService.deleteWasteEntry(storeId!, wasteId);
    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/stores/[id]/waste/[wasteId]", requireStoreAuth: true }
);
