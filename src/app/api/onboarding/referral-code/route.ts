import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { claimReferralCode, previewReferralCode } from "@/lib/services/referral-code.service";
import {
  referralCodeBodySchema,
  referralCodeQuerySchema,
} from "@/lib/validation/onboarding.schemas";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";

/**
 * GET /api/onboarding/referral-code?code=… — the partner code box in the setup
 * wizard. Answers with the partner's name and the % off the first paid invoice
 * while the code is typed; 404 for an unknown, paused or ended code.
 */
export const GET = withApiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const { code } = referralCodeQuerySchema.parse({ code: searchParams.get("code") ?? "" });
    const preview = await previewReferralCode(code);
    if (!preview) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Unknown code"), {
        status: 404,
      });
    }
    return NextResponse.json(createSuccessResponse(preview));
  },
  { rateLimitEndpoint: "/api/onboarding/referral-code" }
);

/**
 * POST /api/onboarding/referral-code { code } — credits the account to the
 * partner now, so a plan paid for before the store is published gets the
 * discount. `credited: false` for a code that can't be used (never an error:
 * the caller carries on to payment either way).
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => null);
    const { code } = referralCodeBodySchema.parse(body ?? {});
    const credited = await claimReferralCode(userId, code);
    return NextResponse.json(createSuccessResponse({ credited }));
  },
  { rateLimitEndpoint: "/api/onboarding/referral-code" }
);
