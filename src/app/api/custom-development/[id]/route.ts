import { NextResponse } from "next/server";
import { customDevelopmentService } from "@/lib/services";
import { updateOwnCustomDevelopmentRequestSchema } from "@/lib/validation/custom-development.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * PATCH /api/custom-development/[id]
 *
 * Update a custom development request owned by the authenticated user.
 */
export const PATCH = withApiHandler(
  async (request, { userId, params }) => {
    const { id } = params;

    const body = await request.json();
    const input = updateOwnCustomDevelopmentRequestSchema.parse(body);

    const updated = await customDevelopmentService.updateOwnRequest(userId, id, input);

    return NextResponse.json(createSuccessResponse(updated));
  },
  {
    rateLimitEndpoint: "/api/custom-development/[id]",
  }
);

/**
 * DELETE /api/custom-development/[id]
 *
 * Delete a custom development request owned by the authenticated user.
 */
export const DELETE = withApiHandler(
  async (_request, { userId, params }) => {
    const { id } = params;

    await customDevelopmentService.deleteOwnRequest(userId, id);

    return NextResponse.json(createSuccessResponse({ deleted: true }));
  },
  {
    rateLimitEndpoint: "/api/custom-development/[id]",
  }
);
