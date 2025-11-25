import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionRepository, storeRepository, userRepository } from "@/lib/repositories";
import { getStoreLimit } from "@/config/stripe.config";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * GET /api/subscriptions/status
 *
 * Get current user's subscription status and details
 *
 * Returns subscription information including:
 * - Plan details
 * - Status
 * - Store usage (current/limit)
 * - Billing period
 * - Cancellation status
 */
export async function GET(request: NextRequest) {
  let session: Session | null = null;
  try {
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, "/api/subscriptions/status");
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

    // Get subscription
    const subscription = await subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      return NextResponse.json(
        createSuccessResponse({
          hasSubscription: false,
          subscription: null,
          storeUsage: null,
        })
      );
    }

    // Get store usage
    const userProfile = await userRepository.getProfile(userId);

    let storeUsage = null;
    if (userProfile?.business) {
      const currentStoreCount = await storeRepository.count({
        businessId: userProfile.business.id,
        isActive: true,
      });

      const limit = getStoreLimit(subscription.plan);

      storeUsage = {
        current: currentStoreCount,
        limit,
        canCreateMore: currentStoreCount < limit,
      };
    }

    return NextResponse.json(
      createSuccessResponse({
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
        storeUsage,
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "GET /api/subscriptions/status",
      context: { userId: session?.user?.id },
    });
  }
}
