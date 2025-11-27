import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * POST /api/subscriptions/portal
 *
 * Create Stripe Customer Portal Session
 * Allows users to manage subscription, payment methods, and invoices
 *
 * Body:
 * - returnUrl?: string (optional, defaults to /profile)
 *
 * Returns:
 * - url: Redirect URL to Stripe Customer Portal
 */
export async function POST(request: NextRequest) {
  let session: Session | null = null;
  try {
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, "/api/subscriptions/portal");
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
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
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
      : `${origin}/profile`;

    // Create portal session
    const portalSession = await subscriptionService.createPortalSession(userId, finalReturnUrl);

    return NextResponse.json(
      createSuccessResponse({
        url: portalSession.url,
        message: "Portal session created successfully",
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/subscriptions/portal",
      context: { userId: session?.user?.id },
    });
  }
}
