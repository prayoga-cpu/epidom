/**
 * POST /api/partner-invite/lookup
 *
 * Public: what /partner-invite shows before anyone is signed in. The token
 * (only ever emailed to the invitee) is the credential; IP rate-limited; in a
 * POST body so it never lands in access logs.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { partnerInviteTokenSchema } from "@/lib/validation/partner.schemas";
import { lookupPartnerInvite } from "@/lib/services/partner.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitMiddleware(request, "/api/partner-invite/lookup");
    if (limited) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }
    const parsed = partnerInviteTokenSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "This invitation link is invalid."),
        { status: 404 }
      );
    }
    return NextResponse.json(createSuccessResponse(await lookupPartnerInvite(parsed.data.token)));
  } catch (error) {
    return handleApiError(error, { endpoint: "/api/partner-invite/lookup", context: {} });
  }
}
