/**
 * @file api/connect/onboarding/route.ts
 * @description Stripe Connect Onboarding API
 * Handles the generation of onboarding links for sellers/business owners.
 */

import { NextResponse } from "next/server";
import { stripeConnectService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/connect/onboarding
 *
 * Generates a secure, temporary link for the user to onboard with Stripe Connect.
 * This allows them to receive payouts from the platform.
 *
 * Body Params (Optional):
 * - refreshUrl: Custom URL to redirect if onboarding link expires
 * - returnUrl: Custom URL to redirect after successful onboarding
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Parse request body for optional custom URLs
    const body = await request.json().catch(() => ({}));
    const { refreshUrl, returnUrl } = body;

    // Generate onboarding link via service
    const onboardingUrl = await stripeConnectService.createAccountLink(
      userId,
      refreshUrl,
      returnUrl
    );

    return NextResponse.json(
      createSuccessResponse({
        url: onboardingUrl,
        message: "Onboarding link created successfully",
      })
    );
  },
  {
    rateLimitEndpoint: "/api/connect/onboarding",
  }
);
