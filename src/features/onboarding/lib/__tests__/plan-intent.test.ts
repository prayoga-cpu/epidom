import { describe, expect, it } from "vitest";
import { emailVerificationCallbackURL } from "@/features/auth/register/lib/verification-landing";
import type { OnboardingBilling } from "@/lib/onboarding/contracts";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  POS_TRIAL_REGISTER_HREF,
  checkoutAfterPublish,
  onboardingPathFor,
  parsePlanIntent,
  planForGoals,
  pricingHrefFor,
  registerHrefFor,
} from "../plan-intent";

const FREE_NEW: OnboardingBilling = { canCheckout: true, posTrialEligible: true };

describe("parsePlanIntent", () => {
  it("reads a paid plan and its billing interval", () => {
    expect(parsePlanIntent(new URLSearchParams("plan=OPERATIONS&billing=yearly"))).toEqual({
      plan: "OPERATIONS",
      yearly: true,
    });
    expect(parsePlanIntent(new URLSearchParams("plan=POS"))).toEqual({
      plan: "POS",
      yearly: false,
    });
  });

  it("ignores Free, Enterprise, unknown plans and no plan at all", () => {
    for (const query of ["plan=FREE", "plan=ENTERPRISE", "plan=pos", "billing=yearly", ""]) {
      expect(parsePlanIntent(new URLSearchParams(query))).toBeNull();
    }
    expect(parsePlanIntent(null)).toBeNull();
  });
});

describe("links", () => {
  it("sign-up carries the plan to the wizard in one encoded `next` the form accepts", () => {
    const href = registerHrefFor({ plan: "OPERATIONS", yearly: true });
    const next = new URL(href, "http://x").searchParams.get("next");
    expect(next).toBe("/onboarding?plan=OPERATIONS&billing=yearly");
    expect(safeInternalPath(next)).toBe(next);
    expect(parsePlanIntent(new URL(next!, "http://x").searchParams)).toEqual({
      plan: "OPERATIONS",
      yearly: true,
    });
  });

  it("the verification link keeps the plan and adds its own flag", () => {
    const landing = emailVerificationCallbackURL(onboardingPathFor({ plan: "POS", yearly: false }));
    const params = new URL(landing, "http://x").searchParams;
    expect(params.get("verified")).toBe("1");
    expect(parsePlanIntent(params)).toEqual({ plan: "POS", yearly: false });
  });

  it("the home page's trial buttons pick POS, billed monthly", () => {
    expect(decodeURIComponent(POS_TRIAL_REGISTER_HREF)).toBe(
      "/register?next=/onboarding?plan=POS&billing=monthly"
    );
  });

  it("the pricing link opens the plan on the localized page", () => {
    expect(pricingHrefFor({ plan: "POS", yearly: false }, "/en/pricing")).toBe(
      "/en/pricing?plan=POS&billing=monthly#plans"
    );
  });
});

describe("planForGoals", () => {
  it("is the highest paid plan picked", () => {
    expect(planForGoals(["storefront", "counter"])).toBe("POS");
    expect(planForGoals(["counter", "operations"])).toBe("OPERATIONS");
    expect(planForGoals(["operations"])).toBe("OPERATIONS");
  });

  it("is null when only the storefront, or nothing, is picked", () => {
    expect(planForGoals(["storefront"])).toBeNull();
    expect(planForGoals([])).toBeNull();
  });
});

describe("checkoutAfterPublish", () => {
  it("a POS goal on a first subscription is the trial, monthly", () => {
    expect(checkoutAfterPublish(["counter"], FREE_NEW, null)).toEqual({
      plan: "POS",
      yearly: false,
      trial: true,
    });
  });

  it("keeps the interval picked on the pricing page for that same plan", () => {
    expect(
      checkoutAfterPublish(["operations"], FREE_NEW, { plan: "OPERATIONS", yearly: true })
    ).toEqual({ plan: "OPERATIONS", yearly: true, trial: false });
  });

  it("follows the goals over the pricing page: a different plan is billed monthly", () => {
    expect(
      checkoutAfterPublish(["counter"], FREE_NEW, { plan: "OPERATIONS", yearly: true })
    ).toEqual({ plan: "POS", yearly: false, trial: true });
  });

  it("unticking the plan's goal means staying on Free", () => {
    expect(
      checkoutAfterPublish(["storefront"], FREE_NEW, { plan: "POS", yearly: false })
    ).toBeNull();
  });

  it("no trial for an account that already had a subscription", () => {
    expect(
      checkoutAfterPublish(["counter"], { canCheckout: true, posTrialEligible: false }, null)
    ).toEqual({ plan: "POS", yearly: false, trial: false });
  });

  it("nothing for an account that can't use a self-serve Checkout", () => {
    expect(
      checkoutAfterPublish(["operations"], { canCheckout: false, posTrialEligible: true }, null)
    ).toBeNull();
  });
});
