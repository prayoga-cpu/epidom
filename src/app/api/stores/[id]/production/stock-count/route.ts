/**
 * POST /api/stores/[id]/production/stock-count — end-of-day count sheet.
 *
 * Submits what is physically on the shelf for counted (BATCH_PRODUCED)
 * products; the service writes one ADJUSTMENT per discrepancy.
 *
 * This is the only path that expenses finished-goods shrinkage under a
 * sale-recognised COGS model — without it, food produced and then binned is
 * never costed at all.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { cuidSchema } from "@/lib/validation/common.schemas";

export const dynamic = "force-dynamic";

const stockCountSchema = z.object({
  counts: z
    .array(
      z.object({
        productId: cuidSchema,
        // Zero is meaningful ("we sold out / binned the rest"), so this is
        // nonnegative rather than positive.
        countedQuantity: z.number().nonnegative().max(1000000),
      })
    )
    .min(1)
    .max(500),
});

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = stockCountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const result = await productionBatchService.applyStockCount(storeId!, parsed.data.counts);
    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/stores/[id]/production/stock-count", requireStoreAuth: true }
);
