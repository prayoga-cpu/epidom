/**
 * @file api/subscriptions/audit/route.ts
 * @description Subscription Audit API
 * Diagnostic endpoint to identify and resolve duplicate subscription issues.
 */

import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/subscriptions/audit
 *
 * Audits the current user's subscription state against Stripe.
 * Automatically attempts to resolve conflicts by:
 * 1. Identifying multiple active subscriptions in Stripe.
 * 2. Keeping the most recent valid subscription.
 * 3. Canceling duplicates.
 * 4. Syncing local database state.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Audit and fix duplicate subscriptions via service logic
    const result = await subscriptionService.auditAndFixDuplicateSubscriptions(userId);

    if (result.duplicatesFound > 0) {
      return NextResponse.json(
        createSuccessResponse({
          message: `Found and canceled ${result.duplicatesFound} duplicate subscription(s)`,
          duplicatesFound: result.duplicatesFound,
          canceledSubscriptionIds: result.canceledSubscriptionIds,
        })
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        message: "No duplicate subscriptions found",
        duplicatesFound: 0,
        canceledSubscriptionIds: [],
      })
    );
  },
  {
    // Strict rate limit for admin/diagnostic tools
    rateLimitEndpoint: "/api/subscriptions/audit",
  }
);
