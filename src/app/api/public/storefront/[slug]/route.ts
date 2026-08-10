import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { recordStorefrontEventSchema } from "@/lib/validation/storefront.schemas";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { hashVisitor } from "@/lib/utils/visitor-hash";
import { isBotUserAgent } from "@/lib/utils/user-agent";

/**
 * GET /api/public/storefront/[slug]
 * 
 * Fetches the public storefront settings, categories, and items by slug.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    if (!slug) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Slug is required"),
        { status: 400 }
      );
    }
    
    // Clean up slug just in case
    const cleanSlug = slug.replace(/^@/, "");
    const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);
    
    if (!storefront || !storefront.isPublished) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Storefront not found or not published"),
        { status: 404 }
      );
    }
    
    return NextResponse.json(createSuccessResponse(storefront));
  } catch (error: any) {
    console.error("[PUBLIC_STOREFRONT_GET_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, error?.message || "Internal server error"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/public/storefront/[slug]
 *
 * Records a public storefront analytics event: a page view (profile, menu,
 * or item detail) or a WhatsApp-button click. Fire-and-forget from the
 * client — never blocks the public page.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Slug is required"),
        { status: 400 }
      );
    }

    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/storefront/[slug]");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }

    const userAgent = request.headers.get("user-agent");
    if (isBotUserAgent(userAgent)) {
      // Not an error — just a no-op so a crawler/link-preview fetch never
      // pollutes the analytics it wasn't a real visitor for.
      return NextResponse.json(createSuccessResponse({ success: true }));
    }

    const body = await request.json().catch(() => ({}));
    const parsed = recordStorefrontEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid event payload"),
        { status: 400 }
      );
    }

    const cleanSlug = slug.replace(/^@/, "");
    const ip =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    // Only the slug is known here (storefrontId is resolved later inside the
    // service) — it works equally well as the per-store salt component.
    const visitorHash = hashVisitor(ip, userAgent ?? "", cleanSlug);

    const result = await storefrontService.recordEvent(cleanSlug, {
      ...parsed.data,
      visitorHash,
    });

    return NextResponse.json(createSuccessResponse(result));
  } catch (error: any) {
    console.error("[PUBLIC_STOREFRONT_POST_EVENT_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, error?.message || "Internal server error"),
      { status: 500 }
    );
  }
}
