/**
 * GET  /api/stores/[id]/discount-presets — the named discounts a cashier can tap
 *      (active only, unless `includeInactive=1` for the Back Office list).
 * POST /api/stores/[id]/discount-presets — create one (manager or owner).
 *
 * OPERATIONS tier, enforced HERE and not only in the UI (contrast the manual
 * discount, whose gate is client-side). The plan is the STORE OWNER's, so a staff
 * account that may read presets is judged on the plan its employer pays for.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requirePromotionsPlanApi } from "@/lib/auth/require-promotions-plan";
import { promotionService } from "@/lib/services/promotion.service";
import {
  presetListQuerySchema,
  upsertDiscountPresetSchema,
} from "@/lib/validation/promotions.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

const FEATURE_LABEL = "Discount presets";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const { includeInactive } = presetListQuerySchema.parse({
      includeInactive: searchParams.get("includeInactive") || undefined,
    });

    const presets = await promotionService.listPresets(storeId!, includeInactive);
    return NextResponse.json(createSuccessResponse(presets));
  },
  { rateLimitEndpoint: "/api/stores/[id]/discount-presets", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const input = upsertDiscountPresetSchema.parse(await readJsonBody(request));
    const preset = await promotionService.createPreset(storeId!, input);
    return NextResponse.json(createSuccessResponse(preset), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/discount-presets", requireStoreAuth: true }
);
