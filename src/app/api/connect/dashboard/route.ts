import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripeConnectService } from "@/lib/services";

/**
 * POST /api/connect/dashboard
 *
 * Generate Stripe Connect dashboard login link
 * Allows Epidom owner to view their earnings, payouts, and account settings
 *
 * Required: User must be authenticated and have completed onboarding
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if onboarding is complete
    const isComplete = await stripeConnectService.isOnboardingComplete(userId);
    if (!isComplete) {
      return NextResponse.json(
        { error: "Stripe Connect onboarding not complete" },
        { status: 400 }
      );
    }

    // Generate dashboard login link
    const dashboardUrl = await stripeConnectService.createDashboardLoginLink(userId);

    return NextResponse.json({
      url: dashboardUrl,
      message: "Dashboard link created successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create dashboard link" },
      { status: 500 }
    );
  }
}
