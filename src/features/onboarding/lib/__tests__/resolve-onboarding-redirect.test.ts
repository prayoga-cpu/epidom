import { describe, expect, it } from "vitest";
import type { OnboardingState } from "@/lib/onboarding/contracts";
import { resolveOnboardingRedirect } from "../resolve-onboarding-redirect";

type StateSlice = Pick<OnboardingState, "completed" | "storeId" | "business">;

const business: NonNullable<OnboardingState["business"]> = {
  name: "Le Petit Four",
  countryCode: "FR",
  city: "Lyon",
  businessType: "bakery",
  timezone: "Europe/Paris",
};

const state = (over: Partial<StateSlice> = {}): StateSlice => ({
  completed: false,
  storeId: null,
  business: null,
  ...over,
});

describe("resolveOnboardingRedirect", () => {
  it("renders the wizard for a brand-new account (no business, no store)", () => {
    expect(
      resolveOnboardingRedirect({ state: state(), onboardingStep: null, isLinkedStaff: false })
    ).toBeNull();
  });

  it("sends a linked staff login without a business of its own to /stores", () => {
    expect(
      resolveOnboardingRedirect({ state: state(), onboardingStep: null, isLinkedStaff: true })
    ).toBe("/stores");
  });

  it("still onboards a staff-linked account that has started its own business", () => {
    expect(
      resolveOnboardingRedirect({
        state: state({ business, storeId: "s1" }),
        onboardingStep: 2,
        isLinkedStaff: true,
      })
    ).toBeNull();
  });

  it("sends a finished setup to /stores", () => {
    expect(
      resolveOnboardingRedirect({
        state: state({ business, storeId: "s1", completed: true }),
        onboardingStep: null,
        isLinkedStaff: false,
      })
    ).toBe("/stores");
  });

  it("keeps a user with zero stores here even after setup was once completed (no bounce)", () => {
    // completed is false in the state whenever there is no store; the helper
    // must not redirect on the business alone either.
    expect(
      resolveOnboardingRedirect({
        state: state({ business, storeId: null, completed: false }),
        onboardingStep: null,
        isLinkedStaff: false,
      })
    ).toBeNull();
  });

  it("sends a legacy account (store, no wizard step, not onboarded) to /stores", () => {
    expect(
      resolveOnboardingRedirect({
        state: state({ business, storeId: "s1" }),
        onboardingStep: null,
        isLinkedStaff: false,
      })
    ).toBe("/stores");
  });

  it.each([2, 3])("resumes a wizard in progress at step %i", (step) => {
    expect(
      resolveOnboardingRedirect({
        state: state({ business, storeId: "s1" }),
        onboardingStep: step,
        isLinkedStaff: false,
      })
    ).toBeNull();
  });
});
