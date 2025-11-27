import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripeConnectService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/connect/status
 *
 * Check Stripe Connect onboarding status for the current user
 * Returns account details and onboarding completion status
 *
 * Required: User must be authenticated
 */
export async function GET(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check onboarding status
    const isComplete = await stripeConnectService.isOnboardingComplete(userId);

    // Get account details
    const accountDetails = await stripeConnectService.getAccountDetails(userId);

    return NextResponse.json(
      createSuccessResponse({
        onboardingComplete: isComplete,
        accountId: accountDetails?.id || null,
        chargesEnabled: accountDetails?.charges_enabled || false,
        payoutsEnabled: accountDetails?.payouts_enabled || false,
        detailsSubmitted: accountDetails?.details_submitted || false,
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "GET /api/connect/status",
      context: {},
    });
  }
}
