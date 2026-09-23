import { NextResponse } from "next/server";
import { storeHasPromotionsPlan } from "@/lib/services/pos-discount.service";
import { minPlanFor, PLAN_LABELS } from "@/lib/plans/entitlements";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * API-route gate for the OPERATIONS-tier promotion routes: discount presets,
 * coupons (+ validate) and loyalty settings — FEATURE_MIN_PLAN.loyaltyAndPromotions.
 *
 * It is only the 403 RESPONSE. Whether the plan qualifies is decided by
 * storeHasPromotionsPlan (pos-discount.service.ts), the very check the order
 * settlement applies when a sale carries a preset / coupon / points — so the
 * routes and the till can never disagree about who has the feature. That
 * check resolves the plan of the STORE'S OWNER (store → business → user →
 * subscription), which is why this takes a storeId and not the session user:
 * a linked staff account that may read presets has no subscription of its own
 * and would otherwise read as FREE (contrast operationsGuard).
 *
 *   const gate = await requirePromotionsPlanApi(storeId!, "Coupons");
 *   if (gate) return gate;
 *
 * @returns a 403 SUBSCRIPTION_FEATURE_LOCKED response to return immediately, or null to proceed.
 */
export async function requirePromotionsPlanApi(
  storeId: string,
  label = "This feature"
): Promise<NextResponse | null> {
  if (await storeHasPromotionsPlan(storeId)) return null;

  const required = minPlanFor("loyaltyAndPromotions");
  return NextResponse.json(
    createErrorResponse(
      ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
      `${label} requires the ${PLAN_LABELS[required]} plan.`,
      { feature: "loyaltyAndPromotions", requiredPlan: required, upgradeRequired: true }
    ),
    { status: 403 }
  );
}
