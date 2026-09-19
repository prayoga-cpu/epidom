/**
 * PATCH  /api/stores/[id]/discount-presets/[presetId] — edit / (de)activate a preset.
 * DELETE /api/stores/[id]/discount-presets/[presetId] — hard delete.
 *
 * Manager or owner, OPERATIONS tier. DELETE is safe as a hard delete: an order
 * only ever froze the discount AMOUNT and a reason string, never a foreign key
 * to the preset (contrast Coupon, which keeps an audit FK and has no DELETE).
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requirePromotionsPlanApi } from "@/lib/auth/require-promotions-plan";
import { promotionService } from "@/lib/services/promotion.service";
import { updateDiscountPresetSchema } from "@/lib/validation/promotions.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

const FEATURE_LABEL = "Discount presets";

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const input = updateDiscountPresetSchema.parse(await readJsonBody(request));
    const preset = await promotionService.updatePreset(storeId!, params.presetId, input);
    return NextResponse.json(createSuccessResponse(preset));
  },
  { rateLimitEndpoint: "/api/stores/[id]/discount-presets/[presetId]", requireStoreAuth: true }
);

export const DELETE = withApiHandler(
  async (_request, { storeId, params }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    await promotionService.deletePreset(storeId!, params.presetId);
    return NextResponse.json(createSuccessResponse({ id: params.presetId, deleted: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/discount-presets/[presetId]", requireStoreAuth: true }
);
