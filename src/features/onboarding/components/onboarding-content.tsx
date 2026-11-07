"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { getBrowserTimezone, useDefaultCountryCode } from "@/features/stores/shared";
import { markSetupSkipped } from "@/features/stores/stores/lib/stores-gatekeeper";
import type { BusinessType } from "@/lib/onboarding/markets";
import type {
  OnboardingBilling,
  OnboardingCompleteResult,
  OnboardingState,
} from "@/lib/onboarding/contracts";
import { OTHER_COUNTRY_CODE, resolveMarketDefaults } from "@/lib/onboarding/markets";
import { useSaveStoreStep, useSaveStorefrontStep } from "../hooks/use-onboarding-steps";
import { useOnboardingLanding } from "../hooks/use-onboarding-landing";
import { useStepErrorHandler } from "../hooks/use-step-error-handler";
import { ONBOARDING_CONFLICT, conflictReason, conflictSuggestion } from "../lib/onboarding-api";
import { trackOnboardingSkipped, trackStepViewed } from "../lib/onboarding-analytics";
import {
  checkoutForChoice,
  defaultPlanChoice,
  flowSteps,
  pickRandomThemeColor,
  sampleMenuItems,
  type FlowStep,
  type PlanChoice,
} from "../lib/onboarding-flow";
import type { InstagramPrefill } from "../lib/instagram-prefill";
import { extrasFromInstagram, slugFromInstagram } from "../lib/instagram-prefill";
import {
  BILLING_PARAM,
  PLAN_PARAM,
  checkoutAfterPublish,
  type PlanCheckout,
  type PlanIntent,
} from "../lib/plan-intent";
import { DraftScreen, draftFromState, type DraftValues } from "./draft-screen";
import { LaunchScreen } from "./launch-screen";
import { PlanStep, ReferralStep, type ClaimedReferral } from "./plan-screen";
import { VerificationNotice } from "./verification-notice";
import { NameStep, TypeStep } from "./welcome-screen";
import { FlowFrame, WizardFrame } from "./wizard-frame";

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

export interface OnboardingContentProps {
  /** Loaded on the server (getOnboardingState): what is saved so far. */
  initialState: OnboardingState;
  /** Loaded on the server (getOnboardingBilling): whether publishing may go on to a plan's Checkout. */
  billing: OnboardingBilling;
  /** A paid plan picked on the pricing or home page before signing up (parsePlanIntent). */
  planIntent?: PlanIntent | null;
  /** The signed-in account, for "Welcome, Sam! Registered as sam@…". */
  user: { name: string | null; email: string };
}

interface StoreAnswers {
  name: string;
  businessType: BusinessType | null;
  prefill: InstagramPrefill | null;
}

/**
 * The setup flow (/onboarding), typeform style: one question on screen at a
 * time, each rising in as the last one is answered (see flowSteps):
 * name → kind of place → plan → referral code → the draft (everything we set
 * up, editable in place, with the button that publishes). Then the launch screen, which starts
 * the chosen plan (the 14-day POS trial, no card, unless another was picked).
 *
 * Nothing is written until the referral question is answered (or, for an
 * account with no plan questions, the kind of place), so skipping before then
 * leaves no half-made store. Skipping on the plan or referral question keeps
 * the Free plan but still saves the store and its draft: the Confirm is all
 * that's left, and finishing it later (the banner on Your Stores, or
 * /onboarding) is what starts the trial.
 */
export function OnboardingContent({
  initialState,
  billing,
  planIntent = null,
  user,
}: OnboardingContentProps) {
  const router = useRouter();
  const { t } = useI18n();
  const detectedCountry = useDefaultCountryCode();
  const saveStore = useSaveStoreStep();
  const saveStorefront = useSaveStorefrontStep();

  const [state, setState] = useState(initialState);
  const showPlan = !initialState.completed && billing.canCheckout;
  const steps = flowSteps(showPlan);
  // A store saved earlier (a skipped setup, another device): straight to the draft and its Confirm.
  const resumed = initialState.storeId !== null && !initialState.completed;
  const [step, setStep] = useState<FlowStep>(resumed ? "draft" : "name");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [answers, setAnswers] = useState<StoreAnswers>({
    name: initialState.business?.name ?? "",
    businessType: initialState.business?.businessType ?? null,
    prefill: null,
  });
  const [choice, setChoice] = useState<PlanChoice>(() => defaultPlanChoice(billing, planIntent));
  const [referral, setReferral] = useState<ClaimedReferral | null>(null);
  const [draft, setDraft] = useState<DraftValues>(() => draftFromState(initialState, false));
  const [settingUp, setSettingUp] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [launch, setLaunch] = useState<OnboardingCompleteResult | null>(null);
  const [checkout, setCheckout] = useState<PlanCheckout | null>(null);

  // "Brand-new account" is decided once, from what the server had before this visit saved anything.
  const [isNewAccount] = useState(initialState.business === null);
  const { verificationError, dismissVerificationError } = useOnboardingLanding({ isNewAccount });

  useEffect(() => {
    if (launch) return;
    if (step === "name") trackStepViewed(1);
    if (step === "draft") trackStepViewed(2);
  }, [step, launch]);

  const go = useCallback((next: FlowStep, dir: "forward" | "back" = "forward") => {
    setDirection(dir);
    setStep(next);
    scrollToTop();
  }, []);

  const index = steps.indexOf(step);
  const next = () => {
    const following = steps[index + 1];
    if (following) go(following);
  };
  const back = () => {
    const previous = steps[index - 1];
    if (previous) go(previous, "back");
  };

  const handleError = useStepErrorHandler({ onStepOrder: () => go("name", "back") });

  const countryCode = state.business?.countryCode ?? detectedCountry ?? undefined;
  const market = resolveMarketDefaults({ countryCode: countryCode ?? OTHER_COUNTRY_CODE });
  const planCurrency = state.business ? state.currency : market.currency;

  /**
   * Saves the store (step 1) and, when it has no menu yet, a draft storefront:
   * a random colour and three example dishes for its kind of place. Returns
   * false (after a toast) when something failed.
   */
  const setUpStore = async (): Promise<boolean> => {
    setSettingUp(true);
    try {
      const browserTimezone = getBrowserTimezone();
      const slugFromPrefill = slugFromInstagram(answers.prefill);
      const base = {
        name: answers.name.trim(),
        countryCode: countryCode ?? OTHER_COUNTRY_CODE,
        ...(answers.businessType ? { businessType: answers.businessType } : {}),
        ...(!countryCode || countryCode === OTHER_COUNTRY_CODE ? { currency: state.currency } : {}),
        ...(browserTimezone ? { browserTimezone } : {}),
        ...extrasFromInstagram(answers.prefill),
      };
      let saved: OnboardingState;
      try {
        saved = await saveStore.mutateAsync({
          ...base,
          ...(slugFromPrefill ? { slug: slugFromPrefill } : {}),
        });
      } catch (error) {
        // The Instagram link is taken: the free one the server suggests.
        const suggestion =
          conflictReason(error) === ONBOARDING_CONFLICT.slugTaken
            ? conflictSuggestion(error)
            : null;
        if (!suggestion) throw error;
        saved = await saveStore.mutateAsync({ ...base, slug: suggestion });
      }

      let latest = saved;
      let samples = false;
      if (saved.menuItems.length === 0) {
        latest = await saveStorefront.mutateAsync({
          themeColor: answers.prefill?.themeColor ?? pickRandomThemeColor(),
          menuItems: sampleMenuItems(answers.businessType, saved.currency, t),
        });
        samples = true;
      }
      setState(latest);
      // A fresh draft, unless this is the same store coming round again (edits kept).
      setDraft((current) =>
        samples || current.storeId !== latest.storeId ? draftFromState(latest, samples) : current
      );
      return true;
    } catch (error) {
      handleError(error);
      return false;
    } finally {
      setSettingUp(false);
    }
  };

  // Free plan. Never for an account already on a plan: activate-free would reset it to Free.
  const leaveForFree = async () => {
    try {
      if (billing.canCheckout) {
        const res = await fetch("/api/subscriptions/activate-free", { method: "POST" });
        if (!res.ok) throw new Error("activate-free");
      }
      trackOnboardingSkipped();
      markSetupSkipped();
      router.replace("/stores");
    } catch {
      setSkipping(false);
      toast.error(t("onboarding.errors.skipFailed"));
    }
  };

  // Before any answer is saved: nothing to keep.
  const skipEarly = async () => {
    setSkipping(true);
    await leaveForFree();
  };

  // From the plan questions: the store and its draft are kept, so one Confirm is left for later.
  const skipKeepingDraft = async () => {
    setSkipping(true);
    if (!(await setUpStore())) {
      setSkipping(false);
      return;
    }
    await leaveForFree();
  };

  // The last answer before the draft: set the store up, then show what we made.
  const setUpAndShowDraft = async () => {
    if (await setUpStore()) go("draft");
  };

  const planLabel = showPlan
    ? t(
        choice === "trial"
          ? "onboarding.flow.draft.planTrial"
          : choice === "monthly"
            ? "onboarding.flow.draft.planMonthly"
            : choice === "yearly"
              ? "onboarding.flow.draft.planYearly"
              : "onboarding.flow.plan.opsName"
      )
    : null;

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

  const canSkip = !state.completed;
  const planProps = {
    billing,
    intent: planIntent,
    currency: planCurrency,
    choice,
    referral,
    onBack: back,
    onSkip: () => void skipKeepingDraft(),
    skipping,
    direction,
  };

  return (
    <FlowFrame progress={(index + 1) / (steps.length + 1)} notice={notice}>
      {step === "name" ? (
        <NameStep
          key="name"
          user={user}
          value={answers.name}
          onChange={(name) => setAnswers((a) => ({ ...a, name }))}
          onPrefill={(prefill) => setAnswers((a) => ({ ...a, prefill }))}
          countryCode={countryCode}
          onSubmit={next}
          onSkip={canSkip ? () => void skipEarly() : undefined}
          skipping={skipping}
          direction={direction}
        />
      ) : step === "type" ? (
        <TypeStep
          key="type"
          value={answers.businessType}
          onChange={(businessType) => setAnswers((a) => ({ ...a, businessType }))}
          storeName={answers.name.trim()}
          onSubmit={showPlan ? next : () => void setUpAndShowDraft()}
          onBack={back}
          onSkip={canSkip ? () => void skipEarly() : undefined}
          skipping={skipping}
          pending={settingUp}
          direction={direction}
        />
      ) : step === "plan" ? (
        <PlanStep key="plan" {...planProps} onChoice={setChoice} onSubmit={next} />
      ) : step === "referral" ? (
        <ReferralStep
          key="referral"
          {...planProps}
          onReferral={setReferral}
          onSubmit={() => void setUpAndShowDraft()}
          pending={settingUp && !skipping}
        />
      ) : (
        <DraftScreen
          state={state}
          onStateChange={setState}
          planLabel={planLabel}
          onChangePlan={showPlan ? () => go("plan", "back") : undefined}
          referralCode={billing.referral ? undefined : referral?.code}
          draft={draft}
          onDraftChange={setDraft}
          onBack={back}
          direction={direction}
          onStepOrder={() => go("name", "back")}
          onPublished={(result) => {
            // Free unless the account qualifies: see checkoutForChoice / checkoutAfterPublish.
            setCheckout(
              showPlan
                ? checkoutForChoice(choice, billing)
                : checkoutAfterPublish(billing, planIntent)
            );
            setLaunch(result);
            dropPlanFromUrl();
            scrollToTop();
          }}
        />
      )}
    </FlowFrame>
  );
}
