import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api";
import { withApiHandler } from "@/lib/api-handler";
import { SubscriptionPlan } from "@prisma/client";

const VALID_PLANS = new Set<string>(Object.values(SubscriptionPlan));

/**
 * POST /api/subscriptions/activate-free
 *
 * Provisions a free subscription for the current user, bypassing Stripe/Xendit.
 * Accepts optional { plan } body — defaults to FREE.
 * Safe to call multiple times — idempotent upsert.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    let plan: SubscriptionPlan = SubscriptionPlan.FREE;
    try {
      const body = await request.json();
      if (body?.plan && VALID_PLANS.has(body.plan)) {
        plan = body.plan as SubscriptionPlan;
      }
    } catch {
      // no body or invalid JSON — use default
    }
    await subscriptionService.activateFree(userId, plan);
    return NextResponse.json(createSuccessResponse({ activated: true, plan }));
  },
  { rateLimitEndpoint: "/api/subscriptions/activate-free" }
);
