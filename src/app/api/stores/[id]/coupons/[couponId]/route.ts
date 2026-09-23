/**
 * PATCH /api/stores/[id]/coupons/[couponId] — edit / (de)activate a coupon.
 *
 * There is deliberately NO DELETE: an Order keeps `couponId` as an audit link
 * (and a cancel/refund reverses usage against it), so a coupon is retired with
 * `isActive: false`, never removed. `code` cannot be changed — a body that
 * carries one is a 400.
 *
 * Manager or owner, OPERATIONS tier.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requirePromotionsPlanApi } from "@/lib/auth/require-promotions-plan";
import { promotionService } from "@/lib/services/promotion.service";
import { updateCouponSchema } from "@/lib/validation/promotions.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;
    const gate = await requirePromotionsPlanApi(storeId!, "Coupons");
    if (gate) return gate;

    const input = updateCouponSchema.parse(await readJsonBody(request));
    const coupon = await promotionService.updateCoupon(storeId!, params.couponId, input);
    return NextResponse.json(createSuccessResponse(coupon));
  },
  { rateLimitEndpoint: "/api/stores/[id]/coupons/[couponId]", requireStoreAuth: true }
);
