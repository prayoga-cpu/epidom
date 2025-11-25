import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripeConnectService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * POST /api/connect/onboarding
 *
 * Generate Stripe Connect onboarding link for Epidom owner
 * This creates an Express account and returns a Stripe-hosted onboarding URL
 *
 * Required: User must be authenticated
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get request body for custom URLs (optional)
    const body = await request.json().catch(() => ({}));
    const { refreshUrl, returnUrl } = body;

    // Generate onboarding link
    const onboardingUrl = await stripeConnectService.createAccountLink(
      userId,
      refreshUrl,
      returnUrl
    );

    return NextResponse.json(
      createSuccessResponse({
        url: onboardingUrl,
        message: "Onboarding link created successfully",
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/connect/onboarding",
      context: {},
    });
  }
}
