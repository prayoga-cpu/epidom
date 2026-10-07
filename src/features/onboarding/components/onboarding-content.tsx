"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ONBOARDING_STEP,
  type OnboardingBilling,
  type OnboardingCompleteResult,
  type OnboardingState,
  type OnboardingStepNumber,
} from "@/lib/onboarding/contracts";
import { useOnboardingLanding } from "../hooks/use-onboarding-landing";
import { trackStepViewed } from "../lib/onboarding-analytics";
import {
  BILLING_PARAM,
  PLAN_PARAM,
  checkoutAfterPublish,
  type PlanCheckout,
  type PlanIntent,
} from "../lib/plan-intent";
import type { StorefrontDraft } from "../lib/storefront-step-schema";
import { GoalsStep } from "./goals-step";
import { LaunchScreen } from "./launch-screen";
import { StoreStep } from "./store-step";
import { StorefrontStep } from "./storefront-step";
import { VerificationNotice } from "./verification-notice";
import { WizardFrame } from "./wizard-frame";

export interface OnboardingContentProps {
  /** Loaded on the server (getOnboardingState): the step to show and what is saved so far. */
  initialState: OnboardingState;
  /** Loaded on the server (getOnboardingBilling): whether publishing may go on to a plan's Checkout. */
  billing: OnboardingBilling;
  /** A paid plan picked on the pricing or home page before signing up (parsePlanIntent). */
  planIntent?: PlanIntent | null;
}

/**
 * Takes the plan off the address bar once the store is published, so Back
 * from Checkout, or a reload, doesn't ask for it again. history.replaceState
 * rather than router.replace: a router navigation re-runs the page on the
 * server, which redirects a finished setup away from this screen.
 */
function dropPlanFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PLAN_PARAM) && !url.searchParams.has(BILLING_PARAM)) return;
    url.searchParams.delete(PLAN_PARAM);
    url.searchParams.delete(BILLING_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // Leaving the URL as it is only means a reload offers the plan again.
  }
}

function scrollToTop() {
  try {
    window.scrollTo({ top: 0 });
  } catch {
    // Not available (tests, very old browsers): staying put is fine.
  }
}

/**
 * The setup wizard (/onboarding): 1. Your store → 2. Your storefront →
 * 3. Your goals, then the "Your store is live" screen, which goes straight on
 * to Checkout when a POS or Operations goal is picked (see plan-intent.ts).
 *
 * Every step is saved on the server (one mutation per step), and the state
 * each save returns replaces the local one, so a reload, or another device,
 * resumes exactly where the server says the owner is. Back only moves
 * between steps; it never undoes a save. What was typed on step 2 but not
 * saved is kept while the owner goes Back to step 1 and returns.
 */
export function OnboardingContent({
  initialState,
  billing,
  planIntent = null,
}: OnboardingContentProps) {
  const [state, setState] = useState(initialState);
  const [step, setStep] = useState<OnboardingStepNumber>(initialState.step);
  const [launch, setLaunch] = useState<OnboardingCompleteResult | null>(null);
  const [checkout, setCheckout] = useState<PlanCheckout | null>(null);
  const [storefrontDraft, setStorefrontDraft] = useState<StorefrontDraft | null>(null);
  // Until the owner moves, the first step shown focuses its first field;
  // after a move, the new step's heading takes the focus.
  const [hasNavigated, setHasNavigated] = useState(false);
  // "Brand-new account" is decided once, from what the server had before
  // this visit saved anything.
  const [isNewAccount] = useState(initialState.business === null);
  const { verificationError, dismissVerificationError } = useOnboardingLanding({ isNewAccount });

  useEffect(() => {
    if (!launch) trackStepViewed(step);
  }, [step, launch]);

  const goTo = useCallback((next: OnboardingStepNumber) => {
    setHasNavigated(true);
    setStep(next);
    scrollToTop();
  }, []);

  const onSaved = (next: OnboardingState, nextStep: OnboardingStepNumber) => {
    setState(next);
    goTo(nextStep);
  };

  const notice = verificationError ? (
    <VerificationNotice onDismiss={dismissVerificationError} />
  ) : null;

  if (launch) {
    return (
      <WizardFrame notice={notice}>
        <LaunchScreen
          result={launch}
          storeName={state.business?.name ?? ""}
          storeCurrency={state.currency}
          checkout={checkout}
          autoCheckout
        />
      </WizardFrame>
    );
  }

  return (
    <WizardFrame wide={step === ONBOARDING_STEP.storefront} notice={notice}>
      {step === ONBOARDING_STEP.store ? (
        <StoreStep
          key="store"
          state={state}
          focusHeading={hasNavigated}
          onSaved={(next) => onSaved(next, ONBOARDING_STEP.storefront)}
        />
      ) : step === ONBOARDING_STEP.storefront ? (
        <StorefrontStep
          key="storefront"
          state={state}
          draft={storefrontDraft}
          onSaved={(next) => {
            setStorefrontDraft(null);
            onSaved(next, ONBOARDING_STEP.goals);
          }}
          // A returning owner's store is live as soon as step 1 saves
          // (completed): step 1 can't be saved again, so no way back to it.
          onBack={
            state.completed
              ? undefined
              : (draft) => {
                  setStorefrontDraft(draft);
                  goTo(ONBOARDING_STEP.store);
                }
          }
          onStepOrder={() => goTo(ONBOARDING_STEP.store)}
        />
      ) : (
        <GoalsStep
          key="goals"
          state={state}
          billing={billing}
          planIntent={planIntent}
          onBack={() => goTo(ONBOARDING_STEP.storefront)}
          onStepOrder={() => goTo(ONBOARDING_STEP.store)}
          onPublished={(result) => {
            // The goals the server saved decide the plan, whatever was
            // picked before signing up: unticking it means staying on Free.
            setCheckout(checkoutAfterPublish(result.goals, billing, planIntent));
            setLaunch(result);
            dropPlanFromUrl();
            scrollToTop();
          }}
        />
      )}
    </WizardFrame>
  );
}
