/**
 * POST /api/partner-invite/accept
 *
 * Links the invited partner to the signed-in account (it must be the invited,
 * verified address). Then the partner page is theirs.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { partnerInviteTokenSchema } from "@/lib/validation/partner.schemas";
import { acceptPartnerInvite } from "@/lib/services/partner.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitMiddleware(request, "/api/partner-invite/accept");
    if (limited) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Sign in first"), {
        status: 401,
      });
    }
    const parsed = partnerInviteTokenSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "This invitation link is invalid."),
        { status: 404 }
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true, deactivatedAt: true },
    });
    if (!user || user.deactivatedAt) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.FORBIDDEN, "Forbidden"), {
        status: 403,
      });
    }
    return NextResponse.json(
      createSuccessResponse(await acceptPartnerInvite(parsed.data.token, user))
    );
  } catch (error) {
    return handleApiError(error, { endpoint: "/api/partner-invite/accept", context: {} });
  }
}
