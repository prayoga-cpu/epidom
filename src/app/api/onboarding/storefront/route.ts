import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { saveStorefrontStep } from "@/lib/services/onboarding.service";
import { onboardingStorefrontStepSchema } from "@/lib/validation/onboarding.schemas";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * POST /api/onboarding/storefront — setup wizard step 2 ("Your storefront").
 *
 * Logo, colour, tagline and up to 3 menu items priced in the store's
 * currency. Every field is optional, so an empty body skips the step.
 * Idempotent. Body: `onboardingStorefrontStepSchema`; response: the new
 * `OnboardingState`.
 *
 * Errors: 400 validation; 409 `details.reason` "step_order" when step 1 hasn't
 * been saved yet.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => null);
    const input = onboardingStorefrontStepSchema.parse(body ?? {});
    const state = await saveStorefrontStep(userId, input);
    return NextResponse.json(createSuccessResponse(state));
  },
  { rateLimitEndpoint: "/api/onboarding/storefront" }
);
