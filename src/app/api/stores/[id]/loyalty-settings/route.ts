/**
 * GET /api/stores/[id]/loyalty-settings — the store's loyalty-points program.
 * PUT /api/stores/[id]/loyalty-settings — change it (manager or owner).
 *
 * GET always resolves a full object (defaults when the store never configured
 * it), never null — the receipt-settings convention. Enabling requires
 * spendPerPoint > 0 AND pointValue > 0, checked on the merged result, so a
 * body carrying only `enabled` works once the amounts are stored. Amounts are
 * literal in the store's display currency.
 *
 * OPERATIONS tier, enforced server-side.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requirePromotionsPlanApi } from "@/lib/auth/require-promotions-plan";
import { loyaltySettingsService } from "@/lib/services/loyalty-settings.service";
import { updateLoyaltySettingsSchema } from "@/lib/validation/loyalty.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

const FEATURE_LABEL = "Loyalty points";

export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const settings = await loyaltySettingsService.get(storeId!);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/stores/[id]/loyalty-settings", requireStoreAuth: true }
);

export const PUT = withApiHandler(
  async (request, { storeId }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const input = updateLoyaltySettingsSchema.parse(await readJsonBody(request));
    const settings = await loyaltySettingsService.update(storeId!, input);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/stores/[id]/loyalty-settings", requireStoreAuth: true }
);
