import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { newsletterUnsubscribeSchema } from "@/lib/validation/newsletter.schemas";
import { verifyUnsubscribeToken } from "@/lib/newsletter/unsubscribe-token";
import { unsubscribeFromNewsletter } from "@/lib/services/newsletter.service";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * POST /api/public/newsletter/unsubscribe
 *
 * Two callers:
 * - the unsubscribe page's button: JSON `{ token }`;
 * - a mail app's own Unsubscribe button (RFC 8058 one-click): the token in
 *   `?t=` and a form body `List-Unsubscribe=One-Click`.
 *
 * POST only, never GET: link scanners open every URL in an email, and a GET
 * that unsubscribed would unsubscribe readers who never asked.
 */
export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/newsletter/unsubscribe");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }

    const queryToken = new URL(request.url).searchParams.get("t");
    const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
    const body: unknown = isJson ? await request.json().catch(() => null) : null;
    const parsed = newsletterUnsubscribeSchema.safeParse(
      isJson ? body : { token: queryToken ?? "" }
    );
    const email = parsed.success ? verifyUnsubscribeToken(parsed.data.token) : null;
    if (!email) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid link"), {
        status: 400,
      });
    }

    await unsubscribeFromNewsletter(email, isJson ? "link" : "one_click");
    return NextResponse.json(createSuccessResponse({ unsubscribed: true }));
  } catch (error) {
    console.error("[NEWSLETTER_UNSUBSCRIBE_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
