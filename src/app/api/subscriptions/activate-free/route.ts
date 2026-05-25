import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/subscriptions/activate-free
 *
 * Provisions a free OPERATIONS subscription for the current user,
 * bypassing Stripe/Xendit. Used while payment is not yet wired up.
 * Safe to call multiple times — idempotent upsert.
 */
export const POST = withApiHandler(
  async (_request, { userId }) => {
    await subscriptionService.activateFree(userId);
    return NextResponse.json(createSuccessResponse({ activated: true }));
  },
  { rateLimitEndpoint: "/api/subscriptions/activate-free" }
);
