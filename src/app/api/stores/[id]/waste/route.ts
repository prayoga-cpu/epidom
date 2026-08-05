import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { wasteService } from "@/lib/services/waste.service";
import { recordWasteSchema, wasteListQuerySchema } from "@/lib/validation/waste.schemas";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/waste
 * List waste entries for a store, optionally filtered by date range/item/reason.
 *
 * POST /api/stores/[id]/waste
 * Record a new waste entry (Material or Product), deducting stock and
 * creating a linked WASTE stock movement.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const query = wasteListQuerySchema.parse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      materialId: searchParams.get("materialId") ?? undefined,
      productId: searchParams.get("productId") ?? undefined,
      reason: searchParams.get("reason") ?? undefined,
      take: searchParams.get("take") ?? undefined,
      skip: searchParams.get("skip") ?? undefined,
    });

    const result = await wasteService.listWasteEntries(storeId!, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      materialId: query.materialId,
      productId: query.productId,
      reason: query.reason,
      take: query.take,
      skip: query.skip,
    });

    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/stores/[id]/waste", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const input = recordWasteSchema.parse(body);

    const result = await wasteService.recordWaste({
      storeId: storeId!,
      materialId: input.materialId,
      productId: input.productId,
      quantity: Number(input.quantity),
      reason: input.reason,
      customReason: input.customReason,
      notes: input.notes,
      referenceId: input.referenceId,
    });

    return NextResponse.json(createSuccessResponse(result), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/waste", requireStoreAuth: true }
);
