import { NextResponse } from "next/server";
import { customDevelopmentService } from "@/lib/services";
import { createCustomDevelopmentRequestSchema } from "@/lib/validation/custom-development.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/custom-development
 *
 * List the authenticated user's own custom development requests (submission history).
 */
export const GET = withApiHandler(
  async (_request, { userId }) => {
    const requests = await customDevelopmentService.getUserRequests(userId);

    return NextResponse.json(createSuccessResponse(requests));
  },
  {
    rateLimitEndpoint: "/api/custom-development",
  }
);

/**
 * POST /api/custom-development
 *
 * Submit a custom development / feature request (Enterprise plan).
 */
export const POST = withApiHandler(
  async (request, { userId, session }) => {
    const body = await request.json();
    const input = createCustomDevelopmentRequestSchema.parse(body);

    const created = await customDevelopmentService.createRequest(
      userId,
      session.user.name ?? "",
      session.user.email ?? "",
      input
    );

    return NextResponse.json(createSuccessResponse(created), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/custom-development",
  }
);
