import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { completeOnboarding } from "@/lib/services/onboarding.service";
import { onboardingCompleteSchema } from "@/lib/validation/onboarding.schemas";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * POST /api/onboarding/complete — setup wizard step 3 ("Your goals"), then publish.
 *
 * Saves the goals, publishes the draft storefront, clears
 * Business.onboardingStep and sets User.hasOnboarded (subsequent visits to
 * /onboarding redirect away). Idempotent. Body: `{ goals?: OnboardingGoal[] }`
 * (an empty body means no goals); response: `OnboardingCompleteResult`.
 *
 * Errors: 400 validation; 409 `details.reason` "step_order" when there is no
 * store / storefront yet.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => null);
    const input = onboardingCompleteSchema.parse(body ?? {});
    const result = await completeOnboarding(userId, input);
    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/onboarding/complete" }
);
