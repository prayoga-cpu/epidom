/**
 * @file api/connect/status/route.ts
 * @description Stripe Connect Status API
 * Retrieves the current onboarding and account status of the connected account.
 */

import { NextResponse } from "next/server";
import { stripeConnectService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/connect/status
 *
 * Checks Stripe Connect onboarding status for the current user.
 * Returns detailed account capabilities (payouts, charges, etc).
 *
 * @returns {Promise<NextResponse>} Account status object
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    // Check onboarding status
    const isComplete = await stripeConnectService.isOnboardingComplete(userId);

    // Get comprehensive account details
    const accountDetails = await stripeConnectService.getAccountDetails(userId);

    return NextResponse.json(
      createSuccessResponse({
        onboardingComplete: isComplete,
        accountId: accountDetails?.id || null,
        chargesEnabled: accountDetails?.charges_enabled || false,
        payoutsEnabled: accountDetails?.payouts_enabled || false,
        detailsSubmitted: accountDetails?.details_submitted || false,
        // Add more fields here as needed by the frontend
      })
    );
  },
  {
    rateLimitEndpoint: "/api/connect/status",
  }
);
