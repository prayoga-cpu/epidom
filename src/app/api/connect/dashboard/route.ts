/**
 * @file api/connect/dashboard/route.ts
 * @description Stripe Connect Dashboard API
 * Generates login links for the Stripe Express Dashboard.
 */

import { NextResponse } from "next/server";
import { stripeConnectService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/connect/dashboard
 *
 * Generates a single-sign-on (SSO) link for the user to access their Stripe Dashboard.
 *
 * Pre-requisite:
 * - User must have completed Stripe Connect onboarding.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Check if onboarding is complete before generating link
    const isComplete = await stripeConnectService.isOnboardingComplete(userId);

    if (!isComplete) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Stripe Connect onboarding not complete. Please complete onboarding first."
        ),
        { status: 400 }
      );
    }

    // Generate dashboard login link
    const dashboardUrl = await stripeConnectService.createDashboardLoginLink(userId);

    return NextResponse.json(
      createSuccessResponse({
        url: dashboardUrl,
        message: "Dashboard link created successfully",
      })
    );
  },
  {
    rateLimitEndpoint: "/api/connect/dashboard",
  }
);
