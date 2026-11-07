"use client";

import { useState } from "react";
import { Check, Gift, Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/client";
import { normalizeRefCode } from "@/lib/attribution/cookies";
import { formatPlanPrice } from "@/lib/constants/plan-pricing";
import type { OnboardingBilling } from "@/lib/onboarding/contracts";
import { cn } from "@/lib/utils";
import {
  availablePlanChoices,
  posPrices,
  type PlanChoice,
  type PosPrices,
} from "../lib/onboarding-flow";
import type { PlanIntent } from "../lib/plan-intent";
import { onboardingApi } from "../lib/onboarding-api";
import { trackReferralCodeEntered } from "../lib/onboarding-analytics";
import { QuestionShell, QuietButton } from "./question-shell";

/** A partner code the owner claimed on this screen. */
export interface ClaimedReferral {
  code: string;
  displayName: string;
  discountPercent: number;
}

interface StepProps {
  billing: OnboardingBilling;
  intent: PlanIntent | null;
  /** The currency the plans are quoted in: the store's, or the one detected from the device. */
  currency: string;
  choice: PlanChoice;
  referral: ClaimedReferral | null;
  onBack: () => void;
  /** Leave setup for the Free plan; the rest of setup stays one step away. */
  onSkip: () => void;
  skipping?: boolean;
  direction?: "forward" | "back";
}

/** The % off the account's first payment: its own partner credit, else the code claimed here. */
function percentOff(billing: OnboardingBilling, referral: ClaimedReferral | null): number {
  return billing.referral?.discountPercent ?? referral?.discountPercent ?? 0;
}

/**
 * Question 3: how to start. The 14-day POS trial (no card) is already picked;
 * POS monthly or yearly are the alternatives. Skipping keeps the Free plan.
 */
export function PlanStep({
  billing,
  intent,
  currency,
  choice,
  onChoice,
  referral,
  onSubmit,
  onBack,
  onSkip,
  skipping = false,
  direction,
}: StepProps & { onChoice: (choice: PlanChoice) => void; onSubmit: () => void }) {
  const { t, locale } = useI18n();
  const prices = posPrices(currency, locale, percentOff(billing, referral));

  return (
    <QuestionShell
      direction={direction}
      title={t("onboarding.flow.plan.title")}
      subtitle={t("onboarding.flow.plan.subtitle")}
      onSubmit={onSubmit}
      submitLabel={t("onboarding.flow.plan.continue")}
      submitIcon="arrow"
      submitDisabled={skipping}
      onBack={onBack}
      footer={
        <QuietButton onClick={onSkip} disabled={skipping} busy={skipping}>
          {t("onboarding.flow.plan.skip")}
        </QuietButton>
      }
    >
      <div
        role="radiogroup"
        aria-label={t("onboarding.flow.plan.title")}
        className="flex flex-col gap-3"
      >
        {availablePlanChoices(billing, intent).map((option) => (
          <PlanCard
            key={option}
            option={option}
            selected={choice === option}
            onSelect={() => onChoice(option)}
            prices={prices}
            percent={percentOff(billing, referral)}
            currency={prices.currency}
            disabled={skipping}
          />
        ))}
      </div>
    </QuestionShell>
  );
}

/**
 * Question 4: a partner's referral code (optional). Claiming it shows the
 * discount on the picked plan's price at once. An account a partner already
 * credits sees that instead of the box.
 */
export function ReferralStep({
  billing,
  intent,
  currency,
  choice,
  referral,
  onReferral,
  onSubmit,
  onBack,
  onSkip,
  skipping = false,
  pending = false,
  direction,
}: StepProps & {
  onReferral: (referral: ClaimedReferral | null) => void;
  onSubmit: () => void;
  pending?: boolean;
}) {
  const { t, locale } = useI18n();
  const credited = billing.referral;
  const percent = percentOff(billing, referral);
  const prices = posPrices(currency, locale, percent);
  void intent;
  const busy = skipping || pending;

  return (
    <QuestionShell
      direction={direction}
      title={t("onboarding.flow.plan.referralTitle")}
      subtitle={t("onboarding.flow.plan.referralHint")}
      onSubmit={onSubmit}
      submitLabel={
        referral || credited ? t("onboarding.actions.continue") : t("onboarding.flow.plan.noCode")
      }
      submitIcon="arrow"
      submitDisabled={skipping}
      pending={pending}
      pendingLabel={t("onboarding.flow.draft.settingUp")}
      onBack={onBack}
      hint={false}
      footer={
        <QuietButton onClick={onSkip} disabled={busy} busy={skipping}>
          {t("onboarding.flow.plan.skip")}
        </QuietButton>
      }
    >
      {credited ? (
        <p
          role="status"
          data-testid="referral-credited"
          className="flex items-start gap-2 rounded-xl border border-[var(--epi-gold-500)]/40 bg-[var(--epi-gold-500)]/8 px-3 py-2 text-sm"
        >
          <Gift aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--epi-gold-600)]" />
          <span>
            {t("onboarding.referral.credited")
              .replace("{name}", credited.displayName)
              .replace("{discount}", String(credited.discountPercent))}
          </span>
        </p>
      ) : (
        <ReferralClaim referral={referral} onReferral={onReferral} disabled={busy} />
      )}
      {percent > 0 ? (
        <p
          data-testid="referral-price"
          className="text-sm font-medium text-green-700 dark:text-green-400"
        >
          {planDeal(choice, prices, t)}
        </p>
      ) : null}
    </QuestionShell>
  );
}

/** "€13.99 → €12.59 on your first payment" for the picked plan, or "" for plans without a discountable price. */
function planDeal(choice: PlanChoice, prices: PosPrices, t: (key: string) => string): string {
  const line = (before: string, after: string) =>
    t("onboarding.flow.plan.firstPayment").replace("{before}", before).replace("{after}", after);
  if (choice === "yearly") return line(prices.yearlyTotal, prices.yearlyTotalAfter);
  if (choice === "operations") return "";
  return line(prices.monthly, prices.monthlyAfter);
}

function PlanCard({
  option,
  selected,
  onSelect,
  prices,
  percent,
  currency,
  disabled,
}: {
  option: PlanChoice;
  selected: boolean;
  onSelect: () => void;
  prices: PosPrices;
  percent: number;
  currency: PosPrices["currency"];
  disabled: boolean;
}) {
  const { t } = useI18n();
  const discounted = percent > 0;
  const firstPayment = (before: string, after: string) =>
    t("onboarding.flow.plan.firstPayment").replace("{before}", before).replace("{after}", after);

  const content = (() => {
    switch (option) {
      case "trial":
        return {
          name: t("onboarding.flow.plan.trialName"),
          badge: t("onboarding.flow.plan.trialBadge"),
          body: t("onboarding.flow.plan.trialBody"),
          price: t("onboarding.flow.plan.trialThen").replace("{price}", prices.monthly),
          deal: discounted ? firstPayment(prices.monthly, prices.monthlyAfter) : null,
        };
      case "monthly":
        return {
          name: t("onboarding.flow.plan.monthlyName"),
          body: t("onboarding.flow.plan.monthlyBody"),
          price: `${prices.monthly}${t("onboarding.flow.plan.perMonth")}`,
          deal: discounted ? firstPayment(prices.monthly, prices.monthlyAfter) : null,
        };
      case "yearly":
        return {
          name: t("onboarding.flow.plan.yearlyName"),
          body: t("onboarding.flow.plan.yearlyBody").replace("{total}", prices.yearlyTotal),
          price: `${prices.yearlyPerMonth}${t("onboarding.flow.plan.perMonth")}`,
          deal: discounted ? firstPayment(prices.yearlyTotal, prices.yearlyTotalAfter) : null,
        };
      case "operations":
        return {
          name: t("onboarding.flow.plan.opsName"),
          body: t("onboarding.flow.plan.opsBody"),
          price: `${formatPlanPrice("OPERATIONS", currency, "monthly")}${t("onboarding.flow.plan.perMonth")}`,
          deal: null,
        };
    }
  })();

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={`plan-${option}`}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] disabled:opacity-60",
        selected
          ? "border-[var(--epi-gold-500)] bg-[var(--epi-gold-500)]/10"
          : "border-border bg-card hover:bg-accent"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-[var(--epi-gold-500)] bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
            : "border-muted-foreground/40"
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-foreground text-base font-semibold">{content.name}</span>
          {"badge" in content && content.badge ? (
            <span className="rounded-full bg-[var(--epi-gold-500)] px-2 py-0.5 text-[11px] font-semibold text-[var(--epi-navy-900)]">
              {content.badge}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground block text-sm">{content.body}</span>
        <span className="text-foreground block text-sm font-medium">{content.price}</span>
        {content.deal ? (
          <span
            data-testid={`plan-${option}-deal`}
            className="block text-sm font-medium text-green-700 dark:text-green-400"
          >
            {content.deal}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ReferralClaim({
  referral,
  onReferral,
  disabled,
}: {
  referral: ClaimedReferral | null;
  onReferral: (referral: ClaimedReferral | null) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(referral?.code ?? "");
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<"unknown" | "invalid" | null>(null);

  const claim = async () => {
    const code = normalizeRefCode(text);
    if (!code) {
      setProblem("invalid");
      return;
    }
    setChecking(true);
    setProblem(null);
    try {
      const result = await onboardingApi.checkReferralCode(code);
      onReferral({
        code: result.code,
        displayName: result.displayName,
        discountPercent: result.discountPercent,
      });
      trackReferralCodeEntered();
    } catch (error) {
      onReferral(null);
      setProblem(error instanceof ApiClientError && error.status === 404 ? "unknown" : "invalid");
    } finally {
      setChecking(false);
    }
  };

  const remove = () => {
    onReferral(null);
    setText("");
    setProblem(null);
  };

  return (
    <div className="space-y-2 rounded-2xl border p-4">
      <label htmlFor="referral-code" className="flex items-center gap-2 text-sm font-medium">
        <Gift aria-hidden="true" className="size-4 text-[var(--epi-gold-600)]" />
        {t("onboarding.flow.plan.referralTitle")}{" "}
        <span className="text-muted-foreground font-normal">
          {t("storeEssentials.optionalSuffix")}
        </span>
      </label>
      <p className="text-muted-foreground text-xs">{t("onboarding.flow.plan.referralHint")}</p>
      <div className="flex items-center gap-2">
        <Input
          id="referral-code"
          value={text}
          onChange={(event) => {
            setText(event.target.value.toUpperCase());
            if (referral) onReferral(null);
            setProblem(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void claim();
            }
          }}
          placeholder={t("onboarding.referral.placeholder")}
          maxLength={32}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled || checking}
          aria-invalid={problem ? true : undefined}
          aria-describedby="referral-code-status"
          className="h-11 min-w-0 flex-1 font-mono uppercase"
        />
        {referral ? (
          <Button
            type="button"
            variant="outline"
            onClick={remove}
            disabled={disabled}
            className="h-11 shrink-0 rounded-lg"
          >
            {t("onboarding.flow.plan.remove")}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void claim()}
            disabled={disabled || checking || text.trim() === ""}
            className="h-11 shrink-0 rounded-lg"
          >
            {checking ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {checking ? t("onboarding.flow.plan.claiming") : t("onboarding.flow.plan.claim")}
          </Button>
        )}
      </div>
      <div id="referral-code-status" aria-live="polite" className="text-sm">
        {referral ? (
          <p
            data-testid="referral-discount"
            className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400"
          >
            <Check aria-hidden="true" className="size-4" />
            {t("onboarding.referral.valid")
              .replace("{name}", referral.displayName)
              .replace("{discount}", String(referral.discountPercent))}
          </p>
        ) : problem === "unknown" ? (
          <p className="text-destructive">{t("onboarding.referral.unknown")}</p>
        ) : problem === "invalid" ? (
          <p className="text-destructive">{t("onboarding.referral.invalid")}</p>
        ) : null}
      </div>
    </div>
  );
}
