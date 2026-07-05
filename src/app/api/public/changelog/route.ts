import { NextResponse } from "next/server";
import { changelogService } from "@/lib/services/changelog.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/public/changelog
 *
 * Public (unauthenticated) list of releases, newest first.
 */
export async function GET() {
  try {
    const releases = await changelogService.getReleases();
    return NextResponse.json(createSuccessResponse({ releases }));
  } catch (error: any) {
    console.error("[PUBLIC_CHANGELOG]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, error?.message || "Internal server error"),
      { status: 500 }
    );
  }
}
