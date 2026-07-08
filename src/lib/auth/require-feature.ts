import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * API-route guard for OPERATIONS-plan features (materials, recipes, suppliers).
 * Returns a 403 response when the user is below OPERATIONS, or null when allowed.
 *
 *   const gate = await operationsGuard(userId, "Materials management");
 *   if (gate) return gate;
 */
export async function operationsGuard(
  userId: string,
  feature = "This feature"
): Promise<NextResponse | null> {
  const ok = await subscriptionService.hasOperationsAccess(userId);
  if (ok) return null;
  return NextResponse.json(
    createErrorResponse(
      ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
      `${feature} requires the Operations plan.`,
      { upgradeRequired: true }
    ),
    { status: 403 }
  );
}
