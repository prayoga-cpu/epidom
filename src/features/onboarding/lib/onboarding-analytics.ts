import { trackConversion, trackEvent, trackMetaPixelEvent } from "@/lib/analytics";
import type { OnboardingGoal, OnboardingStepNumber } from "@/lib/onboarding/contracts";

/**
 * GA4 events for the setup wizard, so the drop-off between steps is visible.
 * Every call goes through src/lib/analytics, which drops events the visitor
 * hasn't consented to.
 */

export const ONBOARDING_STEP_NAMES: Record<OnboardingStepNumber, string> = {
  1: "store",
  2: "storefront",
  3: "goals",
};

const CATEGORY = "onboarding";

export function trackStepViewed(step: OnboardingStepNumber): void {
  trackEvent("onboarding_step_viewed", {
    event_category: CATEGORY,
    step_number: step,
    step_name: ONBOARDING_STEP_NAMES[step],
  });
}

export type StepCompletion =
  | { step: 1; method: "instagram" | "manual" }
  | { step: 2; method: "saved" | "skipped"; itemsCount: number }
  | { step: 3; goals: OnboardingGoal[] };

export function trackStepCompleted(completion: StepCompletion): void {
  const base = {
    event_category: CATEGORY,
    step_number: completion.step,
    step_name: ONBOARDING_STEP_NAMES[completion.step],
  };
  if (completion.step === 1) {
    trackEvent("onboarding_step_completed", { ...base, method: completion.method });
  } else if (completion.step === 2) {
    trackEvent("onboarding_step_completed", {
      ...base,
      method: completion.method,
      items_count: completion.itemsCount,
    });
  } else {
    trackEvent("onboarding_step_completed", {
      ...base,
      method: "published",
      goals: completion.goals.join(","),
      goals_count: completion.goals.length,
    });
  }
}

/** The key activation milestone: the wizard finished and the storefront is live. */
export function trackOnboardingCompleted(goals: OnboardingGoal[]): void {
  trackConversion("onboarding_completed", {
    goals: goals.join(","),
    goals_count: goals.length,
  });
}

/** Keys that make the landing events fire once per browser session. */
export const EMAIL_VERIFIED_TRACKED_KEY = "epidom:onboarding:email_verified_tracked";
export const GOOGLE_SIGNUP_TRACKED_KEY = "epidom:onboarding:google_signup_tracked";

/** Runs `fire` unless `key` is already set in sessionStorage, then sets it. Storage failures never block the event. */
export function oncePerSession(key: string, fire: () => void): void {
  let seen = false;
  try {
    seen = window.sessionStorage.getItem(key) === "1";
  } catch {
    seen = false;
  }
  if (seen) return;
  fire();
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Private mode / blocked storage: the event already fired, nothing else to do.
  }
}

/** The account's email was just confirmed from a verification link. */
export function trackEmailVerified(): void {
  oncePerSession(EMAIL_VERIFIED_TRACKED_KEY, () => {
    trackEvent("email_verified", { event_category: CATEGORY });
  });
}

/**
 * A brand-new account signed up with Google. Mirrors the email signup's
 * events (use-auth.ts): the GA4 `sign_up` conversion and Meta's standard
 * CompleteRegistration, which Google signups never fired before.
 */
export function trackGoogleSignUp(): void {
  oncePerSession(GOOGLE_SIGNUP_TRACKED_KEY, () => {
    trackConversion("sign_up", { event_label: "google", method: "google" });
    trackMetaPixelEvent("CompleteRegistration", { content_name: "Signup", status: true });
  });
}
