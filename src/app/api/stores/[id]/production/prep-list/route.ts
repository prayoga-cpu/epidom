/**
 * GET  /api/stores/[id]/production/prep-list — what to make today.
 * POST /api/stores/[id]/production/prep-list — one-tap "we made N of these".
 *
 * The prep list is the operational half of the two-tier stock model: a
 * batch-produced product only stays in stock if somebody actually prepares it,
 * and the four-field start/complete flow is exactly the friction that stops
 * people logging prep at all.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { cuidSchema } from "@/lib/validation/common.schemas";

export const dynamic = "force-dynamic";

const quickLogSchema = z.object({
  productId: cuidSchema,
  // A prep run is counted in whole finished units. Capped so a slipped keypress
  // can't drain a store's entire raw-material inventory in one tap.
  quantity: z.number().positive().max(100000),
});

export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const items = await productionBatchService.getPrepList(storeId!);
    return NextResponse.json(createSuccessResponse({ items, total: items.length }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/production/prep-list", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = quickLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const batch = await productionBatchService.quickLogProduction({
      storeId: storeId!,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
    });

    return NextResponse.json(
      createSuccessResponse({
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.actualQuantity ?? 0),
        // How much of this run had already been sold before it was logged. The
        // UI says so out loud rather than quietly crediting less stock than the
        // number the user just typed.
        settledQuantity: Number(batch.settledQuantity),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/production/prep-list", requireStoreAuth: true }
);
