import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * POST /api/subscriptions/audit
 *
 * Audit and fix duplicate active subscriptions for the current user
 *
 * This endpoint:
 * 1. Checks if the user has multiple active Stripe subscriptions
 * 2. Keeps the newest subscription
 * 3. Cancels all older duplicate subscriptions
 * 4. Updates the database to reflect the correct subscription
 *
 * Returns:
 * - duplicatesFound: Number of duplicate subscriptions found
 * - canceledSubscriptionIds: Array of canceled subscription IDs
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized. Please log in first."),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Audit and fix duplicate subscriptions
    const result = await subscriptionService.auditAndFixDuplicateSubscriptions(userId);

    if (result.duplicatesFound > 0) {
      return NextResponse.json(
        createSuccessResponse({
          message: `Found and canceled ${result.duplicatesFound} duplicate subscription(s)`,
          duplicatesFound: result.duplicatesFound,
          canceledSubscriptionIds: result.canceledSubscriptionIds,
        })
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        message: "No duplicate subscriptions found",
        duplicatesFound: 0,
        canceledSubscriptionIds: [],
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/subscriptions/audit",
      context: {},
    });
  }
}
