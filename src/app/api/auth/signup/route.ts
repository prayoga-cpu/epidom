import { NextResponse } from "next/server";
import { createErrorResponse, ApiErrorCode } from "@/types/api";

/**
 * POST /api/auth/signup
 *
 * DEPRECATED: With better-auth, signup is handled through the auth flow.
 * Use authClient.signUp() from the client side instead.
 *
 * This route is kept for backwards compatibility but redirects to better-auth.
 */
export async function POST() {
  return NextResponse.json(
    createErrorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      "Signup is now handled by better-auth. Use authClient.signUp() on the client side."
    ),
    { status: 410 } // Gone - resource no longer available
  );
}
