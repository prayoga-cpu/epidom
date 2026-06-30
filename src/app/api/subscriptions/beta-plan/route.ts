import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { betaPlanSchema } from "@/lib/validation/subscription.schemas";

/**
 * POST /api/subscriptions/beta-plan
 *
 * Freestyle plan switch for admin-granted (BETA) accounts only. These accounts
 * have no Stripe payment method, so they may move to any plan instantly without
 * checkout. The service rejects real Stripe-billed subscriptions.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { plan } = betaPlanSchema.parse(body);

    await subscriptionService.setPrivilegePlan(userId, plan);

    return NextResponse.json(
      createSuccessResponse({ success: true, plan, message: "Plan updated" })
    );
  },
  { rateLimitEndpoint: "/api/subscriptions/beta-plan", requireStoreAuth: false }
);
