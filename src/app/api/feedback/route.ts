import { NextResponse } from "next/server";
import { feedbackService } from "@/lib/services";
import { createFeedbackSchema } from "@/lib/validation/feedback.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/feedback
 *
 * List the authenticated user's own feedback entries (ticket history).
 */
export const GET = withApiHandler(
  async (_request, { userId }) => {
    const feedback = await feedbackService.getUserFeedback(userId);

    return NextResponse.json(createSuccessResponse(feedback));
  },
  {
    rateLimitEndpoint: "/api/feedback",
  }
);

/**
 * POST /api/feedback
 *
 * Submit user feedback (bug report, feature suggestion, general feedback).
 */
export const POST = withApiHandler(
  async (request, { userId, session }) => {
    const body = await request.json();
    const input = createFeedbackSchema.parse(body);

    const feedback = await feedbackService.createFeedback(
      userId,
      session.user.name ?? "",
      session.user.email ?? "",
      input
    );

    return NextResponse.json(createSuccessResponse(feedback), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/feedback",
  }
);
