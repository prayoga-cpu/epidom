/**
 * GET  /api/stores/[id]/coupons — every coupon with its usedCount (Back Office list).
 * POST /api/stores/[id]/coupons — create one (manager or owner).
 *
 * OPERATIONS tier, enforced server-side. The code is stored UPPERCASE and is
 * unique per store (a duplicate is a 409 on the `code` field). Amounts —
 * `value` for FIXED, `minSubtotal` — are literal in the store's display currency.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requirePromotionsPlanApi } from "@/lib/auth/require-promotions-plan";
import { promotionService } from "@/lib/services/promotion.service";
import { createCouponSchema } from "@/lib/validation/promotions.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

const FEATURE_LABEL = "Coupons";

export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const coupons = await promotionService.listCoupons(storeId!);
    return NextResponse.json(createSuccessResponse(coupons));
  },
  { rateLimitEndpoint: "/api/stores/[id]/coupons", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;
    const gate = await requirePromotionsPlanApi(storeId!, FEATURE_LABEL);
    if (gate) return gate;

    const input = createCouponSchema.parse(await readJsonBody(request));
    const coupon = await promotionService.createCoupon(storeId!, input);
    return NextResponse.json(createSuccessResponse(coupon), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/coupons", requireStoreAuth: true }
);
