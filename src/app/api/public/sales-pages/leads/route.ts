import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { salesLeadSchema } from "@/lib/validation/sales-page.schemas";
import { saveSalesLead } from "@/lib/services/sales-page.service";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { isBotUserAgent } from "@/lib/utils/user-agent";

/**
 * POST /api/public/sales-pages/leads
 *
 * Stores a lead captured by public/sales-pages/lead-capture.js — triggered
 * either by the VSL 4-minute timer or an exit-intent popup. Unauthenticated.
 * Also adds the contact to the Resend newsletter audience when
 * RESEND_NEWSLETTER_AUDIENCE_ID is set.
 */
export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/sales-pages/leads");
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
    const parsed = salesLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid lead payload"),
        { status: 400 }
      );
    }

    await saveSalesLead(parsed.data);

    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error("[SALES_LEAD_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
