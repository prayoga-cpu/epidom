import { beforeEach, describe, expect, it } from "vitest";
import {
  WIZARD_REDIRECT_COOLDOWN_MS,
  clearWizardRedirect,
  gatekeeperVerdict,
  rememberWizardRedirect,
  wizardRedirectedRecently,
} from "../stores-gatekeeper";

const staffLink = { storeId: "s2", storeName: "Staffed Cafe" };

describe("gatekeeperVerdict", () => {
  it("an owner with no business, or a business without a store, goes to onboarding", () => {
    expect(gatekeeperVerdict({ business: null, staffLink: null })).toBe("no-store");
    expect(gatekeeperVerdict({ business: { stores: [] }, staffLink: null })).toBe("no-store");
  });

  it("an owner whose setup wizard is still in progress goes back to it", () => {
    expect(
      gatekeeperVerdict({
        hasOnboarded: false,
        business: { stores: [{ id: "s1" }], onboardingStep: 2 },
        staffLink: null,
      })
    ).toBe("wizard-unfinished");
  });

  it("no wizard step (a legacy owner, or one who finished) stays on /stores", () => {
    // The onboarding page sends exactly this owner (step null, has a store) to
    // /stores, so /stores must keep them or the two guards would loop.
    expect(
      gatekeeperVerdict({
        hasOnboarded: false,
        business: { stores: [{ id: "s1" }], onboardingStep: null },
        staffLink: null,
      })
    ).toBe("stay");
    expect(
      gatekeeperVerdict({
        hasOnboarded: true,
        business: { stores: [{ id: "s1" }], onboardingStep: 3 },
        staffLink: null,
      })
    ).toBe("stay");
  });

  it("a response without hasOnboarded never counts as an unfinished wizard", () => {
    expect(
      gatekeeperVerdict({
        business: { stores: [{ id: "s1" }], onboardingStep: 2 },
        staffLink: null,
      })
    ).toBe("stay");
  });

  it("a linked staff login is never sent to onboarding", () => {
    expect(gatekeeperVerdict({ business: null, staffLink })).toBe("stay");
    expect(
      gatekeeperVerdict({
        hasOnboarded: false,
        business: { stores: [{ id: "s1" }], onboardingStep: 1 },
        staffLink,
      })
    ).toBe("stay");
    // Also an owner with zero stores left who is staff elsewhere: the wizard has
    // no way back to their staff card, so /stores keeps them (and shows Create
    // a store, see StoresContainer).
    expect(gatekeeperVerdict({ business: { stores: [] }, staffLink })).toBe("stay");
  });

  it("no profile at all fails open", () => {
    expect(gatekeeperVerdict(null)).toBe("stay");
    expect(gatekeeperVerdict(undefined)).toBe("stay");
  });
});

describe("the wizard-redirect loop breaker", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("remembers a redirect for the cooldown, then forgets it", () => {
    const now = 1_000_000;
    expect(wizardRedirectedRecently(now)).toBe(false);
    rememberWizardRedirect(now);
    expect(wizardRedirectedRecently(now + 1_000)).toBe(true);
    expect(wizardRedirectedRecently(now + WIZARD_REDIRECT_COOLDOWN_MS + 1)).toBe(false);
  });

  it("clearing it lets the next unfinished-wizard visit redirect again", () => {
    rememberWizardRedirect(5_000);
    clearWizardRedirect();
    expect(wizardRedirectedRecently(5_001)).toBe(false);
  });

  it("ignores garbage in storage", () => {
    window.sessionStorage.setItem("epidom:stores-gatekeeper:wizard-redirect-at", "soon");
    expect(wizardRedirectedRecently()).toBe(false);
  });
});
