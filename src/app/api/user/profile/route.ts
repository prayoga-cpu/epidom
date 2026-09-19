import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { userService } from "@/lib/services";
import { updateProfileSchema } from "@/lib/validation/auth.schemas";
import { createSuccessResponse } from "@/types/api";
import { getLinkedStaffForUser } from "@/lib/auth/staff-link";

/**
 * GET /api/user/profile
 *
 * Get current user's profile with business and subscription data.
 *
 * `staffLink` is set when the account is a linked staff login (no business of
 * its own is the normal case): the /stores gatekeeper needs it to tell "signed
 * in as staff at a store" apart from "brand-new user who still has to be
 * onboarded" — both have no business.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    const [profile, link] = await Promise.all([
      userService.getProfile(userId),
      getLinkedStaffForUser(userId),
    ]);

    return NextResponse.json(
      createSuccessResponse({
        ...profile,
        staffLink: link ? { storeId: link.storeId, storeName: link.store.name } : null,
      })
    );
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
