import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { DEMO_SLUG } from "@/lib/demo/demo-constants";
import { isValidStoreSlug, slugifyStoreLink } from "@/features/onboarding/lib/store-link";

/**
 * GET /api/public/storefront-search?q=bob
 *
 * The homepage's "claim your link / find a store" search, called as the
 * visitor types. Returns
 *   { stores: [{ slug, displayName }], link: { slug, available } | null }
 * `stores`: at most six live published storefronts whose link or name contains
 * the query; nothing else about them leaves. `link`: the store link the query
 * would make (same rule as the setup wizard) and whether any storefront,
 * published or not, already holds it; null when the query makes no valid link.
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
      return NextResponse.json(createSuccessResponse({ stores: [], link: null }));
    }

    const slug = slugifyStoreLink(query);
    const [stores, taken] = await Promise.all([
      storefrontService.searchPublished(query),
      isValidStoreSlug(slug) ? storefrontService.isSlugTaken(slug) : Promise.resolve(null),
    ]);
    const link = taken === null ? null : { slug, available: !taken };
    // The public demo café is not a business a visitor is looking for; its link
    // stays "taken" so nobody can claim it.
    return NextResponse.json(
      createSuccessResponse({ stores: stores.filter((s) => s.slug !== DEMO_SLUG), link })
    );
  } catch (error) {
    console.error("[PUBLIC_STOREFRONT_SEARCH_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
