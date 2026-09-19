/**
 * POST /api/stores/[id]/coupons/validate — "does this code work on this cart, and for how much?"
 *
 * Cashier-tier (on the staff-account allow-list). Answers HTTP 200 with a
 * CouponValidationDto for EVERY business outcome — an unknown, expired or used-up
 * code is `valid: false` with a `reason`, not an error — so the cart handles one
 * response shape. Only a malformed request body is a 400.
 *
 * The discount is priced by the server against the `itemsTotal` sent, using the
 * same computeRuleDiscount the order transaction uses. It is advisory: the
 * order re-enforces usage atomically when the sale is placed.
 *
 * OPERATIONS tier. Rate-limited tighter than other reads (see rate-limit.config.ts)
 * because a code is guessable input.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requirePromotionsPlanApi } from "@/lib/auth/require-promotions-plan";
import { promotionService } from "@/lib/services/promotion.service";
import { validateCouponSchema } from "@/lib/validation/promotions.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requirePromotionsPlanApi(storeId!, "Coupons");
    if (gate) return gate;

    const input = validateCouponSchema.parse(await readJsonBody(request));
    const result = await promotionService.validateCoupon(storeId!, input);
    return NextResponse.json(createSuccessResponse(result), { status: 200 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/coupons/validate", requireStoreAuth: true }
);
