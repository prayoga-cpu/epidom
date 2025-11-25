import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

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
  let session: Session | null = null;
  try {
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, "/api/subscriptions/checkout");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // Verify session
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized. Please log in first."),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const { plan, successUrl, cancelUrl } = body;

    // Validate plan
    if (!plan || (plan !== "STARTER" && plan !== "PRO")) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Invalid plan. Must be STARTER or PRO"),
        { status: 400 }
      );
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

    return NextResponse.json(
      createSuccessResponse({
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        message: "Checkout session created successfully",
      }),
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/subscriptions/checkout",
      context: { userId: session?.user?.id },
    });
  }
}
