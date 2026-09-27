import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { saveStoreStep, uiLocaleFromRequest } from "@/lib/services/onboarding.service";
import { onboardingStoreStepSchema } from "@/lib/validation/onboarding.schemas";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * POST /api/onboarding/store — setup wizard step 1 ("Your store").
 *
 * Creates or updates the owner's business, first store (with its OWNER staff
 * row), FREE plan when the account has none, finance settings derived from
 * the country, and the draft storefront. Idempotent. Body:
 * `onboardingStoreStepSchema`; response: the new `OnboardingState`.
 *
 * Errors: 400 validation; 409 `details.reason` "slug_taken" (with
 * `details.suggestion`) or "already_completed".
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => null);
    const input = onboardingStoreStepSchema.parse(body);
    const state = await saveStoreStep(userId, input, uiLocaleFromRequest(request));
    return NextResponse.json(createSuccessResponse(state));
  },
  { rateLimitEndpoint: "/api/onboarding/store" }
);
