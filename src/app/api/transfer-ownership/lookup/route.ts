/**
 * POST /api/transfer-ownership/lookup
 *
 * Public: what the accept page shows before anyone is signed in (store name,
 * who's handing it over, which email it was sent to). Holding the token IS the
 * credential — it only ever went to the recipient's inbox — so there's no
 * session requirement, but it is IP rate-limited. A POST with the token in the
 * body (not a GET with it in the URL) so it never lands in access logs or the
 * audit trail's recorded pathnames.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { transferTokenSchema } from "@/lib/validation/store-transfer.schemas";
import { lookupStoreTransfer } from "@/lib/services/store-transfer.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/transfer-ownership/lookup");
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

    const parsed = transferTokenSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "This transfer link is invalid."),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(await lookupStoreTransfer(parsed.data.token)));
  } catch (error) {
    return handleApiError(error, { endpoint: "/api/transfer-ownership/lookup", context: {} });
  }
}
