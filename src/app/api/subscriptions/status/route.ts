import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionRepository, storeRepository, userRepository } from "@/lib/repositories";
import { getStoreLimit } from "@/config/stripe.config";

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
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get subscription
    const subscription = await subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        storeUsage: null,
      });
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

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error("[API] Subscription status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get subscription status" },
      { status: 500 }
    );
  }
}
