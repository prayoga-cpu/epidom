import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionService } from "@/lib/services";

/**
 * POST /api/subscriptions/cancel
 *
 * Cancel user's subscription at the end of the billing period
 * User retains access until the current period ends
 *
 * To reactivate, use the Customer Portal
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Cancel subscription
    await subscriptionService.cancelSubscription(userId);

    return NextResponse.json({
      success: true,
      message: "Subscription will be canceled at the end of the billing period",
    });
  } catch (error: any) {
    console.error("[API] Cancel subscription error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
