import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { syncCheckoutSession } from "@/lib/services/stripe-subscription-sync.service";
import { createSuccessResponse } from "@/types/api/responses";

const bodySchema = z.object({ sessionId: z.string().min(1).max(255) });

/**
 * POST /api/subscriptions/sync-checkout { sessionId }
 *
 * The Checkout success page calls this on arrival: the owner's own paid
 * session is confirmed with Stripe and recorded exactly as the webhook would
 * record it, so the plan is active the moment they are sent back to the app,
 * whether or not the webhook has arrived (or can reach this server at all, as
 * in local development). Safe to repeat. `synced: false` for a session that
 * isn't theirs or isn't paid, which is not an error.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const { sessionId } = bodySchema.parse(await request.json());
    const synced = await syncCheckoutSession(userId, sessionId);
    return NextResponse.json(createSuccessResponse({ synced }));
  },
  { rateLimitEndpoint: "/api/subscriptions/sync-checkout" }
);
