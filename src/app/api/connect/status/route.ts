import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripeConnectService } from "@/lib/services";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check onboarding status
    const isComplete = await stripeConnectService.isOnboardingComplete(userId);

    // Get account details
    const accountDetails = await stripeConnectService.getAccountDetails(userId);

    return NextResponse.json({
      onboardingComplete: isComplete,
      accountId: accountDetails?.id || null,
      chargesEnabled: accountDetails?.charges_enabled || false,
      payoutsEnabled: accountDetails?.payouts_enabled || false,
      detailsSubmitted: accountDetails?.details_submitted || false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check onboarding status" },
      { status: 500 }
    );
  }
}
