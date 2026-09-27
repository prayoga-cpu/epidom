import { NextResponse } from "next/server";
import { getStorePlan } from "@/lib/plans/store-plan";
import {
  minPlanFor,
  planHasFeature,
  PLAN_LABELS,
  type PlanFeature,
} from "@/lib/plans/entitlements";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * API-route plan gate for any FEATURE_MIN_PLAN feature, judged on the plan of
 * the STORE'S OWNER (getStorePlan: store → business → user → subscription,
 * anything not ACTIVE counts as FREE) — the same rule requirePlan applies to
 * the page. A linked staff account has no subscription of its own, so gating
 * on the session user would read it as FREE.
 *
 *   const gate = await requireStoreFeatureApi(storeId!, "finance", "Finance reports");
 *   if (gate) return gate;
 *
 * Page layouts already redirect below tier; this is what stops the same data
 * being read by calling the route directly.
 *
 * @returns a 403 SUBSCRIPTION_FEATURE_LOCKED response to return immediately, or null to proceed.
 */
export async function requireStoreFeatureApi(
  storeId: string,
  feature: PlanFeature,
  label = "This feature"
): Promise<NextResponse | null> {
  const plan = await getStorePlan(storeId);
  if (planHasFeature(plan, feature)) return null;

  const required = minPlanFor(feature);
  return NextResponse.json(
    createErrorResponse(
      ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
      `${label} requires the ${PLAN_LABELS[required]} plan.`,
      { feature, requiredPlan: required, upgradeRequired: true }
    ),
    { status: 403 }
  );
}
