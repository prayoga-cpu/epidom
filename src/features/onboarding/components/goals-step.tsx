"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Boxes,
  Check,
  Globe,
  Loader2,
  MonitorSmartphone,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  ONBOARDING_GOALS,
  type OnboardingBilling,
  type OnboardingCompleteResult,
  type OnboardingGoal,
  type OnboardingState,
} from "@/lib/onboarding/contracts";
import { PLAN_LABELS, type PlanTier } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";
import { useCompleteOnboarding } from "../hooks/use-onboarding-steps";
import { useStepErrorHandler } from "../hooks/use-step-error-handler";
import { trackOnboardingCompleted, trackStepCompleted } from "../lib/onboarding-analytics";
import {
  GOAL_PLAN,
  INTENT_GOAL,
  checkoutAfterPublish,
  type PlanCheckout,
  type PlanIntent,
} from "../lib/plan-intent";
import {
  PRIMARY_BUTTON_CLASS,
  StepBody,
  StepHeading,
  WizardActions,
  WizardProgress,
} from "./wizard-frame";

interface GoalOption {
  goal: OnboardingGoal;
  icon: LucideIcon;
}

/** The three spaces of Epidom; GOAL_PLAN names the plan that unlocks each. */
const GOAL_OPTIONS: GoalOption[] = [
  { goal: "storefront", icon: Globe },
  { goal: "counter", icon: MonitorSmartphone },
  { goal: "operations", icon: Boxes },
];

/** What the hint under the cards says publishing leads to. */
function nextStepKey(checkout: PlanCheckout): string {
  if (checkout.trial) return "onboarding.goals.next.trial";
  return checkout.plan === "POS" ? "onboarding.goals.next.pos" : "onboarding.goals.next.operations";
}

const goalsSchema = z.object({ goals: z.array(z.enum(ONBOARDING_GOALS)) });
type GoalsFormValues = z.infer<typeof goalsSchema>;

export interface GoalsStepProps {
  state: OnboardingState;
  billing: OnboardingBilling;
  /** A plan picked before signing up: its goal starts ticked when nothing is saved yet. */
  planIntent?: PlanIntent | null;
  onBack: () => void;
  onPublished: (result: OnboardingCompleteResult) => void;
  onStepOrder: () => void;
}

/**
 * Step 3, "What do you want Epidom to help with?": pick any of the three
 * spaces (or none), then publish. The picks order the Getting-started
 * checklist, and a POS or Operations pick goes on to that plan's Checkout
 * after publishing (the POS trial: a card, nothing charged today). The hint
 * under the cards says so before the owner presses Publish.
 */
export function GoalsStep({
  state,
  billing,
  planIntent = null,
  onBack,
  onPublished,
  onStepOrder,
}: GoalsStepProps) {
  const { t } = useI18n();
  const form = useForm<GoalsFormValues>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      goals: state.goals.length === 0 && planIntent ? [INTENT_GOAL[planIntent.plan]] : state.goals,
    },
  });
  const pickedGoals = form.watch("goals");
  const checkout = checkoutAfterPublish(pickedGoals, billing, planIntent);
  const mutation = useCompleteOnboarding();
  const handleError = useStepErrorHandler({ onStepOrder });
  const pending = mutation.isPending;

  const onSubmit = form.handleSubmit(({ goals }) => {
    // Keep the cards' order, whatever order they were ticked in.
    const ordered = ONBOARDING_GOALS.filter((goal) => goals.includes(goal));
    mutation.mutate(ordered, {
      onSuccess: (result) => {
        trackStepCompleted({ step: 3, goals: result.goals });
        trackOnboardingCompleted(result.goals);
        onPublished(result);
      },
      onError: (error) => handleError(error, "onboarding.errors.publishFailed"),
    });
  });

  // POS / Operations are product names, the same in every language; "Free" is not.
  const planLabel = (plan: PlanTier) =>
    plan === "FREE" ? t("onboarding.goals.free") : PLAN_LABELS[plan];

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <WizardProgress step={3} />
        <StepBody>
          <StepHeading
            title={t("onboarding.goals.title")}
            subtitle={t("onboarding.goals.subtitle")}
            focusOnMount
          />

          <Controller
            control={form.control}
            name="goals"
            render={({ field }) => (
              <fieldset className="grid gap-3" disabled={pending}>
                <legend className="sr-only">{t("onboarding.goals.title")}</legend>
                {GOAL_OPTIONS.map(({ goal, icon: Icon }) => {
                  const plan = GOAL_PLAN[goal];
                  const checked = field.value.includes(goal);
                  const toggle = () =>
                    field.onChange(
                      checked ? field.value.filter((g) => g !== goal) : [...field.value, goal]
                    );
                  return (
                    <label
                      key={goal}
                      className={cn(
                        "has-[:focus-visible]:ring-ring relative flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 sm:gap-4 sm:p-5",
                        checked
                          ? "border-[var(--epi-gold-500)] bg-[var(--epi-gold-500)]/8"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="checkbox"
                        name={field.name}
                        value={goal}
                        checked={checked}
                        onChange={toggle}
                        onBlur={field.onBlur}
                        className="sr-only"
                        aria-describedby={`goal-${goal}-description`}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-lg",
                          checked
                            ? "bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-foreground text-base font-semibold">
                            {t(`onboarding.goals.options.${goal}.title`)}
                          </span>
                          <span className="text-muted-foreground bg-muted rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                            {planLabel(plan)}
                          </span>
                        </span>
                        <span
                          id={`goal-${goal}-description`}
                          className="text-muted-foreground block text-sm"
                        >
                          {t(`onboarding.goals.options.${goal}.description`)}
                        </span>
                        {goal === "counter" && billing.posTrialEligible ? (
                          <span className="block text-xs font-medium text-[var(--epi-gold-600)]">
                            {t("onboarding.goals.options.counter.trial")}
                          </span>
                        ) : null}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                          checked
                            ? "border-[var(--epi-gold-500)] bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {checked ? <Check className="size-4" /> : null}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          />

          <div aria-live="polite" className="space-y-2">
            {checkout ? (
              <p
                data-testid="goals-next-step"
                className="rounded-lg border border-[var(--epi-gold-500)]/40 bg-[var(--epi-gold-500)]/8 px-3 py-2 text-sm"
              >
                {t(nextStepKey(checkout))} {t("onboarding.goals.next.stayFree")}
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm">{t("onboarding.goals.publishHint")}</p>
          </div>
        </StepBody>

        <WizardActions onBack={onBack} backDisabled={pending}>
          <Button
            type="submit"
            disabled={pending}
            className={cn(PRIMARY_BUTTON_CLASS, "min-w-0 flex-1 sm:min-w-48 sm:flex-none")}
          >
            {pending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                <span className="truncate">{t("onboarding.actions.publishing")}</span>
              </>
            ) : (
              <>
                <Rocket aria-hidden="true" />
                <span className="truncate">{t("onboarding.actions.publish")}</span>
              </>
            )}
          </Button>
        </WizardActions>
      </form>
    </Form>
  );
}
