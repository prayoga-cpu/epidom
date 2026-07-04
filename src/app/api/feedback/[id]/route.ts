import { NextResponse } from "next/server";
import { feedbackService } from "@/lib/services";
import { updateOwnFeedbackSchema } from "@/lib/validation/feedback.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * PATCH /api/feedback/[id]
 *
 * Update a feedback entry owned by the authenticated user.
 */
export const PATCH = withApiHandler(
  async (request, { userId, params }) => {
    const { id } = params;

    const body = await request.json();
    const input = updateOwnFeedbackSchema.parse(body);

    const updated = await feedbackService.updateOwnFeedback(userId, id, input);

    return NextResponse.json(createSuccessResponse(updated));
  },
  {
    rateLimitEndpoint: "/api/feedback/[id]",
  }
);

/**
 * DELETE /api/feedback/[id]
 *
 * Delete a feedback entry owned by the authenticated user.
 */
export const DELETE = withApiHandler(
  async (_request, { userId, params }) => {
    const { id } = params;

    await feedbackService.deleteOwnFeedback(userId, id);

    return NextResponse.json(createSuccessResponse({ deleted: true }));
  },
  {
    rateLimitEndpoint: "/api/feedback/[id]",
  }
);
