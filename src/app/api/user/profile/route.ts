import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { userService } from "@/lib/services";
import { updateProfileSchema } from "@/lib/validation/auth.schemas";
import { createSuccessResponse } from "@/types/api";

/**
 * GET /api/user/profile
 *
 * Get current user's profile with business and subscription data.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    // Get profile via service
    const profile = await userService.getProfile(userId);

    return NextResponse.json(createSuccessResponse(profile));
  },
  { rateLimitEndpoint: "/api/user/profile", requireStoreAuth: false }
);

/**
 * PATCH /api/user/profile
 *
 * Update current user's profile information.
 */
export const PATCH = withApiHandler(
  async (request, { userId }) => {
    // Parse and validate request body
    const body = await request.json();
    const input = updateProfileSchema.parse(body);

    // Update profile via service
    const updatedUser = await userService.updateProfile(userId, input);

    return NextResponse.json(createSuccessResponse(updatedUser));
  },
  { rateLimitEndpoint: "/api/user/profile", requireStoreAuth: false }
);
