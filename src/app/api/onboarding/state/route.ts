import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getOnboardingState } from "@/lib/services/onboarding.service";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * GET /api/onboarding/state
 *
 * Where the signed-in owner is in the setup wizard: the step to show, what
 * has been saved so far (business, draft storefront, first menu items) and
 * the store's currency. Returns an `OnboardingState`
 * (src/lib/onboarding/contracts.ts) inside the usual success envelope.
 */
export const GET = withApiHandler(
  async (_request, { userId }) => {
    const state = await getOnboardingState(userId);
    return NextResponse.json(createSuccessResponse(state));
  },
  { rateLimitEndpoint: "/api/onboarding/state" }
);
