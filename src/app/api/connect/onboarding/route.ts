import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripeConnectService } from "@/lib/services";

/**
 * POST /api/connect/onboarding
 *
 * Generate Stripe Connect onboarding link for Epidom owner
 * This creates an Express account and returns a Stripe-hosted onboarding URL
 *
 * Required: User must be authenticated
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get request body for custom URLs (optional)
    const body = await request.json().catch(() => ({}));
    const { refreshUrl, returnUrl } = body;

    // Generate onboarding link
    const onboardingUrl = await stripeConnectService.createAccountLink(
      userId,
      refreshUrl,
      returnUrl
    );

    return NextResponse.json({
      url: onboardingUrl,
      message: "Onboarding link created successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to create onboarding link",
        details: process.env.NODE_ENV === "development" ? error.type || error.code : undefined,
      },
      { status: 500 }
    );
  }
}
