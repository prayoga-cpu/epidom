import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * POST /api/subscriptions/cancel
 *
 * Cancel user's subscription at the end of the billing period
 * User retains access until the current period ends
 *
 * To reactivate, use the Customer Portal
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Cancel subscription
    await subscriptionService.cancelSubscription(userId);

    return NextResponse.json(
      createSuccessResponse({
        success: true,
        message: "Subscription will be canceled at the end of the billing period",
      })
    );
  },
  { rateLimitEndpoint: "/api/subscriptions/cancel", requireStoreAuth: false }
);
