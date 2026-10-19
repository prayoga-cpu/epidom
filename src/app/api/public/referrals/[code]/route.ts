import { NextResponse } from "next/server";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { getReferralBanner } from "@/lib/services/partner.service";

/**
 * GET /api/public/referrals/[code]
 *
 * What the referral banner on /register and the home page shows for a
 * partner's code: their display name and the % off the first payment. 404 for
 * an unknown code or a partner who is paused or ended. Unauthenticated.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = await rateLimitMiddleware(request, "/api/public/referrals/[code]");
  if (limited) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
      { status: 429 }
    );
  }
  const { code } = await params;
  const banner = await getReferralBanner(code).catch(() => null);
  if (!banner) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Unknown code"), {
      status: 404,
    });
  }
  return NextResponse.json(createSuccessResponse(banner), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
