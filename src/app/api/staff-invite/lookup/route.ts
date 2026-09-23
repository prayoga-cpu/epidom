/**
 * POST /api/staff-invite/lookup
 *
 * Public: what the claim page shows before anyone has done anything (who the
 * invite is for, which store, a MASKED email, and whether an account already
 * exists for it). Holding the token is the credential — it only ever went to
 * one inbox — so there's no session requirement, but it is IP rate-limited.
 * A POST with the token in the body (not a GET with it in the URL) so it never
 * lands in access logs or the audit trail's recorded pathnames — same
 * convention as /api/transfer-ownership/lookup.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { staffInviteTokenSchema } from "@/lib/validation/staff-invite.schemas";
import { lookupStaffInvite } from "@/lib/services/staff-invite.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/staff-invite/lookup");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    const parsed = staffInviteTokenSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(createSuccessResponse({ state: "not_found" }));
    }

    return NextResponse.json(createSuccessResponse(await lookupStaffInvite(parsed.data.token)));
  } catch (error) {
    return handleApiError(error, { endpoint: "/api/staff-invite/lookup", context: {} });
  }
}
