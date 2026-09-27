import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { userService } from "@/lib/services";
import { updateProfileSchema } from "@/lib/validation/auth.schemas";
import { createSuccessResponse } from "@/types/api";
import { getLinkedStaffForUser } from "@/lib/auth/staff-link";
import { toPublicBusiness } from "@/lib/auth/owner-pin";

/**
 * GET /api/user/profile
 *
 * Get current user's profile with business and subscription data.
 *
 * `staffLink` is set when the account is a linked staff login (no business of
 * its own is the normal case): the /stores gatekeeper needs it to tell "signed
 * in as staff at a store" apart from "brand-new user who still has to be
 * onboarded" — both have no business.
 *
 * `hasOnboarded` (top level) and `business.onboardingStep` are always present
 * (false / null when unset): the gatekeeper sends an owner whose setup wizard
 * is still in progress (a non-null step) back to /onboarding.
 *
 * `business` never carries `ownerPin` (the PIN hash); `business.hasOwnerPin`
 * says whether one is set.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    const [profile, link] = await Promise.all([
      userService.getProfile(userId),
      getLinkedStaffForUser(userId),
    ]);

    // The repository returns the full rows, but UserProfileDto doesn't declare
    // these two, so they are read and re-set explicitly rather than relied on
    // to ride along in the spread.
    const onboarding = profile as typeof profile & {
      hasOnboarded?: boolean | null;
      business: (NonNullable<typeof profile.business> & { onboardingStep?: number | null }) | null;
    };

    return NextResponse.json(
      createSuccessResponse({
        ...profile,
        hasOnboarded: onboarding.hasOnboarded === true,
        // Never the owner PIN hash: a staff persona on the owner's device can
        // open this URL on the owner's session. `hasOwnerPin` replaces it.
        business: onboarding.business
          ? {
              ...toPublicBusiness(onboarding.business),
              onboardingStep: onboarding.business.onboardingStep ?? null,
            }
          : null,
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
