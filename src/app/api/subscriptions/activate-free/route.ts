import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api";
import { withApiHandler } from "@/lib/api-handler";
import { SubscriptionPlan } from "@prisma/client";
import {
  ACTIVATE_FREE_ONLY_MESSAGE,
  activateFreeSchema,
} from "@/lib/validation/activate-free.schemas";
import { FieldError } from "@/lib/errors/field-error";
import { logger } from "@/lib/logger";

/**
 * POST /api/subscriptions/activate-free
 *
 * Provisions the FREE plan for the current user, bypassing Stripe/Xendit.
 * This is the only plan it will ever grant: it has no payment step, so a
 * client-supplied paid plan is rejected (400), never coerced or honoured.
 * An empty or unparsable body means FREE. Idempotent upsert.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // No body or invalid JSON: treat as an empty request (defaults to FREE).
    const body = await request.json().catch(() => null);

    const parsed = activateFreeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      const attempted = typeof body?.plan === "string" ? body.plan.slice(0, 32) : typeof body?.plan;
      logger.warn("activate-free rejected a non-FREE plan", { userId, attempted });
      throw new FieldError("plan", ACTIVATE_FREE_ONLY_MESSAGE);
    }

    await subscriptionService.activateFree(userId, SubscriptionPlan.FREE);
    return NextResponse.json(
      createSuccessResponse({ activated: true, plan: SubscriptionPlan.FREE })
    );
  },
  { rateLimitEndpoint: "/api/subscriptions/activate-free" }
);
