import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { recordSalesPageEventSchema } from "@/lib/validation/sales-page.schemas";
import { recordSalesPageEvent } from "@/lib/services/sales-page.service";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { hashVisitor } from "@/lib/utils/visitor-hash";
import { isBotUserAgent } from "@/lib/utils/user-agent";

/**
 * POST /api/public/sales-pages/events
 *
 * Records a view, button click or scroll milestone on a /sales-page-N landing
 * page, sent by public/sales-pages/tracker.js (via sendBeacon, so the answer
 * is never read). Unauthenticated, like the storefront analytics route.
 */
export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/sales-pages/events");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }

    const userAgent = request.headers.get("user-agent");
    if (isBotUserAgent(userAgent)) {
      // A crawler or link preview is not a visitor: answer, record nothing.
      return NextResponse.json(createSuccessResponse({ success: true }));
    }

    const body = await request.json().catch(() => ({}));
    const parsed = recordSalesPageEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid event payload"),
        { status: 400 }
      );
    }

    const ip =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    // One salt for all the pages, so a visitor who opens two of them has the
    // same hash on both that day.
    const visitorHash = hashVisitor(ip, userAgent ?? "", "sales-pages");

    await recordSalesPageEvent({ ...parsed.data, visitorHash });

    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error("[SALES_PAGE_EVENT_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
