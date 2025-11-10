import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";

/**
 * POST /api/subscriptions/portal
 *
 * Create Stripe Customer Portal Session
 * Allows users to manage subscription, payment methods, and invoices
 *
 * Body:
 * - returnUrl?: string (optional, defaults to /billing)
 *
 * Returns:
 * - url: Redirect URL to Stripe Customer Portal
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { returnUrl } = body;

    // Get origin for building absolute URL
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Build return URL
    const finalReturnUrl = returnUrl
      ? `${origin}${returnUrl}`
      : `${origin}/billing`;

    // Create portal session
    const portalSession = await subscriptionService.createPortalSession(userId, finalReturnUrl);

    return NextResponse.json({
      url: portalSession.url,
      message: "Portal session created successfully",
    });
  } catch (error: any) {
    console.error("[API] Portal session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
