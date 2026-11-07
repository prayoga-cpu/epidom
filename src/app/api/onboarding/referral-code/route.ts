import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { previewReferralCode } from "@/lib/services/referral-code.service";
import { referralCodeQuerySchema } from "@/lib/validation/onboarding.schemas";
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
