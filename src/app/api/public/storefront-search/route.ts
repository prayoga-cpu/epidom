import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * GET /api/public/storefront-search?q=bob
 *
 * The homepage's "find your store" search, called as the visitor types. Returns
 * { stores: [{ slug, displayName }] }, at most six live published storefronts
 * whose @username or name contains the query. Nothing else about them leaves.
 */
export async function GET(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/storefront-search");
    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"),
        { status: 429 }
      );
    }

    // "@bob", "epidom.fr/@bob" → "bob". Anything but letters, digits, spaces,
    // apostrophes and hyphens is dropped, which also keeps LIKE wildcards out.
    const raw = new URL(request.url).searchParams.get("q") ?? "";
    const query = raw
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^[^/\s]*\/(?=@)/, "")
      .replace(/^@/, "")
      .replace(/[^\p{L}\p{N} '-]/gu, "")
      .slice(0, 60)
      .trim();
    if (query.length < 2) {
      return NextResponse.json(createSuccessResponse({ stores: [] }));
    }

    const stores = await storefrontService.searchPublished(query);
    return NextResponse.json(createSuccessResponse({ stores }));
  } catch (error) {
    console.error("[PUBLIC_STOREFRONT_SEARCH_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
