import { NextRequest, NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";

import { subscriptionService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * POST /api/subscriptions/cancel
 *
 * Cancel user's subscription at the end of the billing period
 * User retains access until the current period ends
 *
 * To reactivate, use the Customer Portal
 */
export async function POST(request: NextRequest) {
  let session: Session | null = null;
  try {
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, "/api/subscriptions/cancel");
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
    session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Cancel subscription
    await subscriptionService.cancelSubscription(userId);

    return NextResponse.json(
      createSuccessResponse({
        success: true,
        message: "Subscription will be canceled at the end of the billing period",
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/subscriptions/cancel",
      context: { userId: session?.user?.id },
    });
  }
}
