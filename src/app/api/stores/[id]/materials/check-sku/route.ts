import { NextResponse } from "next/server";
import { materialRepository } from "@/lib/repositories/material.repository";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/materials/check-sku?sku=FLO-001&excludeId=mat_123
 *
 * Returns { available: boolean } — checks whether a SKU is free within this
 * store. `excludeId` lets an edit form check its own current SKU without it
 * flagging itself as taken.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku")?.trim();
    const excludeId = searchParams.get("excludeId") || undefined;

    if (!sku) {
      return NextResponse.json(createSuccessResponse({ available: false, reason: "empty" }));
    }

    const exists = await materialRepository.existsBySku(storeId!, sku, excludeId);

    return NextResponse.json(
      createSuccessResponse({ available: !exists, reason: exists ? "taken" : null })
    );
  },
  { requireStoreAuth: true }
);
