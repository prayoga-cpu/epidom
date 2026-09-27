import type { OnboardingState } from "@/lib/onboarding/contracts";

export interface OnboardingRedirectInput {
  state: Pick<OnboardingState, "completed" | "storeId" | "business">;
  /** Business.onboardingStep exactly as stored: null when unset, or when there is no business. */
  onboardingStep: number | null;
  /** The account is a linked staff login (an active, non-OWNER StaffMember row; see getLinkedStaffForUser). */
  isLinkedStaff: boolean;
}

/** Where /onboarding sends someone who shouldn't see the setup wizard. */
export const ONBOARDING_EXIT_PATH = "/stores";

/**
 * Whether /onboarding should redirect away instead of rendering the wizard,
 * and where to. Null means "render the wizard at state.step".
 *
 * 1. A linked staff login with no business of its own goes to /stores: the
 *    wizard is the owner's merchant setup, not theirs, and the /stores
 *    gatekeeper never sends staff back here.
 * 2. Zero stores always belongs here, whatever else is true. `hasOnboarded`
 *    stays true forever once set, while stores can be deleted afterwards
 *    (`businessService.deleteStore` has no last-store guard), so the two can
 *    disagree. When they do, sending the user to /stores is an infinite
 *    bounce: StoresContainer's compliance check sees zero stores and
 *    hard-navigates straight back to /onboarding, which would redirect out
 *    again. A user with no stores belongs on onboarding, since that is where a
 *    store gets created, regardless of having once completed it.
 * 3. Setup finished (User.hasOnboarded with a store) goes to /stores.
 * 4. A store but no wizard step and not onboarded is an account that predates
 *    the wizard (or set its store up elsewhere): /stores, never a wizard
 *    asking it to redo a store that already runs. A wizard in progress
 *    always has a step (step 1 saves Business.onboardingStep >= 2).
 */
export function resolveOnboardingRedirect({
  state,
  onboardingStep,
  isLinkedStaff,
}: OnboardingRedirectInput): typeof ONBOARDING_EXIT_PATH | null {
  if (isLinkedStaff && !state.business) return ONBOARDING_EXIT_PATH;
  if (!state.storeId) return null;
  if (state.completed) return ONBOARDING_EXIT_PATH;
  if (onboardingStep === null) return ONBOARDING_EXIT_PATH;
  return null;
}
