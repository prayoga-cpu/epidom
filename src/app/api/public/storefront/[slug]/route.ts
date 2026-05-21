import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

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
 * POST /api/public/storefront/[slug]/view
 * 
 * Increments the storefront view count analytics.
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
    
    const cleanSlug = slug.replace(/^@/, "");
    await storefrontService.incrementViewCount(cleanSlug);
    
    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error: any) {
    console.error("[PUBLIC_STOREFRONT_POST_VIEW_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, error?.message || "Internal server error"),
      { status: 500 }
    );
  }
}
