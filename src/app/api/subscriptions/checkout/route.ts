import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";

/**
 * POST /api/subscriptions/checkout
 *
 * Create Stripe Checkout Session for subscription
 *
 * Body:
 * - plan: "STARTER" | "PRO"
 * - successUrl?: string (optional, defaults to /checkout/success)
 * - cancelUrl?: string (optional, defaults to /checkout/failed)
 *
 * Returns:
 * - sessionId: Stripe Checkout Session ID
 * - url: Redirect URL to Stripe Checkout
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const { plan, successUrl, cancelUrl } = body;

    // Validate plan
    if (!plan || (plan !== "STARTER" && plan !== "PRO")) {
      return NextResponse.json({ error: "Invalid plan. Must be STARTER or PRO" }, { status: 400 });
    }

    // Get origin for building absolute URLs
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Build success and cancel URLs
    const finalSuccessUrl = successUrl
      ? `${origin}${successUrl}`
      : `${origin}/checkout/success?plan=${plan}`;

    const finalCancelUrl = cancelUrl
      ? `${origin}${cancelUrl}`
      : `${origin}/checkout/failed?reason=canceled`;

    // Create checkout session
    const checkoutSession = await subscriptionService.createCheckoutSession(
      userId,
      plan,
      finalSuccessUrl,
      finalCancelUrl
    );

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      message: "Checkout session created successfully",
    });
  } catch (error: any) {
    // Handle specific error messages
    if (error.message.includes("already have the")) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 } // Conflict status
      );
    }

    if (error.message.includes("Epidom owner")) {
      return NextResponse.json(
        { error: "Payment system is not configured yet. Please contact support." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
