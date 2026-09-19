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
import { prisma } from "@/lib/prisma";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { linkedStaffWhere } from "@/lib/auth/staff-link";

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
    // Asked from inside a store (?storeId=), by a linked staff account: the
    // plan that governs what they see is the STORE OWNER's, not anything of
    // their own — a staff login has no subscription, and the auto-provisioning
    // below would otherwise mint one for them and report FREE, locking every
    // POS feature in their UI. Read-only and stripped of billing detail: they
    // can neither manage payment nor see a quoted custom price. The owner's
    // own request (and any request without a storeId) takes the path below
    // exactly as before.
    const requestedStoreId = new URL(request.url).searchParams.get("storeId");
    if (requestedStoreId) {
      const access = await verifyStoreAccess(requestedStoreId, userId).catch(() => null);
      if (access?.accessType === "staff") {
        const business = await prisma.business.findUnique({
          where: { id: access.store.businessId },
          select: { userId: true },
        });
        const ownerSub = business
          ? await subscriptionRepository.findByUserId(business.userId)
          : null;
        return NextResponse.json(
          createSuccessResponse({
            hasSubscription: !!ownerSub,
            subscription: ownerSub
              ? {
                  id: ownerSub.id,
                  plan: ownerSub.plan,
                  status: ownerSub.status,
                  currentPeriodStart: ownerSub.currentPeriodStart,
                  currentPeriodEnd: ownerSub.currentPeriodEnd,
                  trialEndsAt: ownerSub.trialEndsAt,
                  isTrialing: !!ownerSub.trialEndsAt && ownerSub.trialEndsAt > new Date(),
                  cancelAtPeriodEnd: ownerSub.cancelAtPeriodEnd,
                  canManagePayment: false,
                  canCancel: false,
                  isBeta: false,
                  customPriceAmount: null,
                  customPriceCurrency: null,
                  customPriceInterval: null,
                  customPricePlan: null,
                  customPricePending: ownerSub.customPricePendingAt != null,
                }
              : null,
            storeUsage: null,
          })
        );
      }
    }

    // Get subscription — auto-provision free plan if missing (beta bypass)
    let subscription = await subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      // A staff-only login (linked to a staff profile, no business of its own)
      // opening the store list has no subscription of its own to speak of, and
      // must not have one minted just for looking. Someone who owns a business
      // — including an owner who is ALSO linked as staff elsewhere — falls
      // through to the normal provisioning below.
      const ownsBusiness = await prisma.business.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!ownsBusiness) {
        const staffLink = await prisma.staffMember.findFirst({
          where: linkedStaffWhere(userId),
          select: { id: true },
        });
        if (staffLink) {
          return NextResponse.json(
            createSuccessResponse({ hasSubscription: false, subscription: null, storeUsage: null })
          );
        }
      }

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
          trialEndsAt: subscription.trialEndsAt,
          // On a trial while the window is still open (used for the "trial ends in
          // N days" badge). Trialing subscriptions report status ACTIVE.
          isTrialing: !!subscription.trialEndsAt && subscription.trialEndsAt > new Date(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          // Whether Stripe-managed billing actions are available. The customer
          // portal needs a real Stripe customer (free plans use a "free_" stub),
          // and cancellation needs an actual Stripe subscription id.
          canManagePayment: !subscription.stripeCustomerId.startsWith("free_"),
          canCancel: !!subscription.stripeSubscriptionId,
          // Admin-granted (privilege) account — no payment method attached. These
          // "BETA" accounts may switch plans freestyle without Stripe checkout.
          isBeta: subscription.stripeCustomerId.startsWith("admin_"),
          // Admin-set custom price override — see Subscription.customPriceAmount.
          customPriceAmount:
            subscription.customPriceAmount != null ? Number(subscription.customPriceAmount) : null,
          customPriceCurrency: subscription.customPriceCurrency,
          customPriceInterval: subscription.customPriceInterval,
          customPricePlan: subscription.customPricePlan,
          // Quoted but unpaid: access is suspended until this Checkout Session
          // completes (POST /api/subscriptions/custom-price/checkout).
          customPricePending: subscription.customPricePendingAt != null,
        },
        storeUsage,
      })
    );
  },
  {
    rateLimitEndpoint: "/api/subscriptions/status",
  }
);
