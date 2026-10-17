import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { recordTrackingEventSchema } from "@/lib/validation/tracking-event.schemas";
import { recordTrackingEvent } from "@/lib/services/tracking-event.service";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { isBotUserAgent } from "@/lib/utils/user-agent";

/**
 * POST /api/public/tracking-events
 *
 * The first-party copy of a Meta Pixel event or a cookie-bar answer, sent by
 * src/lib/tracking-events.ts and public/sales-pages/pixel.js (via sendBeacon,
 * so the answer is never read). Unauthenticated; stores nothing that
 * identifies the visitor. Read on /admin/pixel.
 */
export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/tracking-events");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }

    if (isBotUserAgent(request.headers.get("user-agent"))) {
      // A crawler is not a visitor: answer, record nothing.
      return NextResponse.json(createSuccessResponse({ success: true }));
    }

    const body = await request.json().catch(() => ({}));
    const parsed = recordTrackingEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid event payload"),
        { status: 400 }
      );
    }

    await recordTrackingEvent(parsed.data);

    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error("[TRACKING_EVENT_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
