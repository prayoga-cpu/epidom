"use client";

import * as React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import LangSwitcher from "@/components/lang/lang-switcher";
import { Button } from "@/components/ui/button";
import { EpidomLockup } from "@/features/marketing/shared/components/epidom-logo";
import { ONBOARDING_STEP, type OnboardingStepNumber } from "@/lib/onboarding/contracts";
import { cn } from "@/lib/utils";

/**
 * The setup wizard's page chrome. Phones get the step full-bleed with a
 * sticky action bar at the bottom of the screen; from `sm` up it is a
 * centred card (max-w-2xl; step 2 widens on large screens to fit its live
 * preview beside the form).
 */
export function WizardFrame({
  children,
  wide = false,
  notice,
}: {
  children: React.ReactNode;
  /** Step 2: room for the phone preview next to the form on large screens. */
  wide?: boolean;
  /** Rendered above the card (e.g. the verification-link notice). */
  notice?: React.ReactNode;
}) {
  return (
    <div className="bg-background sm:bg-muted/40 flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <div className="text-foreground">
          <EpidomLockup size={26} />
        </div>
        <LangSwitcher />
      </header>
      <main className="flex min-h-0 flex-1 flex-col sm:items-center sm:px-4 sm:pb-10">
        {notice ? <div className="w-full px-4 pb-3 sm:max-w-2xl sm:px-0">{notice}</div> : null}
        <div
          className={cn(
            "bg-background flex min-h-0 w-full flex-1 flex-col sm:max-w-2xl sm:flex-none sm:rounded-2xl sm:border sm:shadow-sm",
            wide && "lg:max-w-5xl"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

const STEP_KEYS: Record<OnboardingStepNumber, string> = {
  1: "onboarding.progress.steps.store",
  2: "onboarding.progress.steps.storefront",
  3: "onboarding.progress.steps.goals",
};

const TOTAL_STEPS = ONBOARDING_STEP.goals;

/** "Step 1 of 3" and three labelled segments (Your store · Your storefront · Your goals). */
export function WizardProgress({ step }: { step: OnboardingStepNumber }) {
  const { t } = useI18n();
  const steps = [ONBOARDING_STEP.store, ONBOARDING_STEP.storefront, ONBOARDING_STEP.goals];

  return (
    <nav aria-label={t("onboarding.progress.label")} className="px-4 pt-4 sm:px-8 sm:pt-8">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("onboarding.progress.stepOf")
          .replace("{current}", String(step))
          .replace("{total}", String(TOTAL_STEPS))}
      </p>
      <ol className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
        {steps.map((s) => {
          const done = s < step;
          const current = s === step;
          return (
            <li key={s} aria-current={current ? "step" : undefined} className="min-w-0">
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1.5 rounded-full transition-colors",
                  done || current ? "bg-[var(--epi-gold-500)]" : "bg-muted"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 flex items-start gap-1 text-[11px] leading-tight sm:text-xs",
                  current ? "text-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                {done ? (
                  <Check
                    aria-hidden="true"
                    className="mt-px size-3 shrink-0 text-[var(--epi-gold-600)]"
                  />
                ) : null}
                <span className="min-w-0 break-words">{t(STEP_KEYS[s])}</span>
                {done ? <span className="sr-only">{t("onboarding.progress.done")}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The step's title. Takes the focus when a step is reached with Continue or
 * Back, so a screen reader announces the new step instead of staying on a
 * button that no longer exists.
 */
export function StepHeading({
  title,
  subtitle,
  focusOnMount = false,
  action,
}: {
  title: string;
  subtitle?: string;
  focusOnMount?: boolean;
  action?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1
          ref={ref}
          tabIndex={-1}
          className="text-foreground text-xl font-bold tracking-tight outline-none sm:text-2xl"
        >
          {title}
        </h1>
        {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** The step's scrolling body, between the progress header and the action bar. */
export function StepBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 space-y-6 px-4 py-6 sm:px-8", className)}>{children}</div>
  );
}

export const PRIMARY_BUTTON_CLASS =
  "h-11 rounded-xl bg-[var(--epi-gold-500)] px-5 font-semibold text-[var(--epi-navy-900)] hover:bg-[var(--epi-gold-600)]";

/**
 * Back / (secondary) / Continue. Sticky at the bottom of the screen, so the
 * next step is always one tap away on a phone however long the step is; the
 * safe-area padding keeps it clear of the iOS home indicator. Back is
 * icon-only on phones to leave room for the other buttons.
 */
export function WizardActions({
  onBack,
  backDisabled,
  secondary,
  children,
}: {
  onBack?: () => void;
  backDisabled?: boolean;
  /** An extra button between Back and the primary one (e.g. "Skip for now"). */
  secondary?: React.ReactNode;
  /** The primary action (a submit button). */
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 flex items-center gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:gap-3 sm:rounded-b-2xl sm:px-8 sm:py-4">
      {onBack ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={backDisabled}
          className="h-11 min-w-11 shrink-0 rounded-xl px-3 sm:px-4"
        >
          <ArrowLeft aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t("onboarding.actions.back")}</span>
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
        {secondary}
        {children}
      </div>
    </div>
  );
}
