import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { newsletterSubscribeSchema } from "@/lib/validation/newsletter.schemas";
import { subscribeToNewsletter } from "@/lib/services/newsletter.service";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { isBotUserAgent } from "@/lib/utils/user-agent";

export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/newsletter/subscribe");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }

    const userAgent = request.headers.get("user-agent");
    if (isBotUserAgent(userAgent)) {
      return NextResponse.json(createSuccessResponse({ success: true }));
    }

    const body = await request.json().catch(() => ({}));
    const parsed = newsletterSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid payload"),
        { status: 400 }
      );
    }

    await subscribeToNewsletter(parsed.data);
    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error("[NEWSLETTER_SUBSCRIBE_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
