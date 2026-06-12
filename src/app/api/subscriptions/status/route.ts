/**
 * @file api/subscriptions/status/route.ts
 * @description Subscription Status API
 * Returns user's current subscription details and usage limits.
 */

import { NextResponse } from "next/server";
import { subscriptionRepository, storeRepository, userRepository } from "@/lib/repositories";
import { subscriptionService } from "@/lib/services";
import { getStoreLimit } from "@/config/stripe.config";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/subscriptions/status
 *
 * Retrieves:
 * - Current subscription details (Plan, Status, etc.)
 * - Store usage limits (Important for UI logic)
 *
 * During beta: auto-provisions a free OPERATIONS plan if none exists.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    // Get subscription — auto-provision free plan if missing (beta bypass)
    let subscription = await subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      await subscriptionService.activateFree(userId, "FREE");
      subscription = await subscriptionRepository.findByUserId(userId);
    }

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
    let storeUsage;

    if (userProfile?.business) {
      // If business exists, count actual stores
      const currentStoreCount = await storeRepository.count({
        businessId: userProfile.business.id,
      });

      const limit = getStoreLimit(subscription.plan);

      storeUsage = {
        current: currentStoreCount,
        limit,
        canCreateMore: currentStoreCount < limit,
      };
    } else {
      // If no business yet, assume 0 stores usage
      // This allows the frontend to show "Create Store" button
      const limit = getStoreLimit(subscription.plan);

      storeUsage = {
        current: 0,
        limit,
        canCreateMore: 0 < limit, // Should be true for all plans (even POS limit is 1)
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
  },
  {
    rateLimitEndpoint: "/api/subscriptions/status",
  }
);
