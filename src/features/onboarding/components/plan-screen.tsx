"use client";

import { useState } from "react";
import type * as React from "react";
import { BadgePercent, Check, Info, Loader2, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { PlanBillingToggle } from "@/components/shared/plan-billing-toggle";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/client";
import { normalizeRefCode } from "@/lib/attribution/cookies";
import type { OnboardingBilling } from "@/lib/onboarding/contracts";
import { cn } from "@/lib/utils";
import { yearlySavingsPercent } from "@/features/dashboard/billing/lib/plan-price";
import type { PriceCurrency } from "@/lib/constants/plan-pricing";
import { posPrices, type PlanChoice, type PosPrices } from "../lib/onboarding-flow";
import { onboardingApi } from "../lib/onboarding-api";
import { trackReferralCodeEntered } from "../lib/onboarding-analytics";
import { firstNameOf } from "../lib/onboarding-flow";
import { QuestionShell, QuietButton } from "./question-shell";

/** A partner code the owner claimed on this screen. */
export interface ClaimedReferral {
  code: string;
  displayName: string;
  discountPercent: number;
}

/** The % off the account's first payment: its own partner credit, else the code claimed here. */
function percentOff(billing: OnboardingBilling, referral: ClaimedReferral | null): number {
  return billing.referral?.discountPercent ?? referral?.discountPercent ?? 0;
}

type Plan = "POS" | "OPERATIONS";
type Interval = "monthly" | "yearly";

/** The pick as a plan, whether the free trial is on, and the interval it is billed at. */
function parseChoice(choice: PlanChoice): { plan: Plan; trial: boolean; yearly: boolean } {
  switch (choice) {
    case "trial":
      return { plan: "POS", trial: true, yearly: false };
    case "trialYearly":
      return { plan: "POS", trial: true, yearly: true };
    case "monthly":
      return { plan: "POS", trial: false, yearly: false };
    case "yearly":
      return { plan: "POS", trial: false, yearly: true };
    case "operations":
      return { plan: "OPERATIONS", trial: false, yearly: false };
    case "operationsYearly":
      return { plan: "OPERATIONS", trial: false, yearly: true };
  }
}

function composeChoice(plan: Plan, trial: boolean, yearly: boolean): PlanChoice {
  if (plan === "POS") {
    if (trial) return yearly ? "trialYearly" : "trial";
    return yearly ? "yearly" : "monthly";
  }
  return yearly ? "operationsYearly" : "operations";
}

/**
 * Screen 1: "Welcome, Sam!" and everything about the plan on one page, as two
 * cards side by side (POS, Operations) under a Monthly / Yearly toggle. POS
 * starts selected with its 14-day free trial on (no card needed); the switch
 * in its card turns the trial off for a paid POS. A paid pick goes to payment
 * once the store is live. Under the cards, an optional partner referral code:
 * claiming it shows who referred the account and drops the prices at once.
 * Skipping keeps the Free plan.
 */
export function PlanStep({
  user,
  billing,
  currency,
  onCurrency,
  choice,
  onChoice,
  referral,
  onReferral,
  onSubmit,
  onBack,
  onSkip,
  skipping = false,
  pending = false,
  direction,
}: {
  user: { name: string | null; email: string };
  billing: OnboardingBilling;
  /** The currency the plans are quoted in: the store's, or the one detected from the device. */
  currency: string;
  /** The owner picked another currency to be quoted (and charged) in. */
  onCurrency: (currency: PriceCurrency) => void;
  choice: PlanChoice;
  onChoice: (choice: PlanChoice) => void;
  referral: ClaimedReferral | null;
  onReferral: (referral: ClaimedReferral | null) => void;
  onSubmit: () => void;
  /** Absent on the very first screen. */
  onBack?: () => void;
  /** Leave setup for the Free plan. */
  onSkip: () => void;
  skipping?: boolean;
  /** Payment is opening (a paid pick goes to Stripe first). */
  pending?: boolean;
  direction?: "forward" | "back";
}) {
  const { t, locale } = useI18n();
  const credited = billing.referral;
  const percent = percentOff(billing, referral);
  const prices = posPrices(currency, locale, percent);
  const paid =
    billing.paidPlan === "POS" || billing.paidPlan === "OPERATIONS" ? billing.paidPlan : null;
  const picked = paid
    ? parseChoice(paid === "POS" ? "monthly" : "operations")
    : parseChoice(choice);
  // The toggle is what the cards show; a trial pick has no interval of its own, so it follows the toggle.
  const [interval, setInterval] = useState<Interval>(picked.yearly ? "yearly" : "monthly");
  const yearly = interval === "yearly";
  const trialOffered = billing.posTrialEligible;
  // Phones: the plan whose details pop-up is open.
  const [detail, setDetail] = useState<Plan | null>(null);
  const savings = yearlySavingsPercent(prices.currency);

  const pick = (plan: Plan, trial: boolean, nextYearly = yearly) =>
    onChoice(composeChoice(plan, plan === "POS" && trialOffered && trial, nextYearly));

  const renderCard = (plan: Plan, variant: "card" | "sheet") => {
    const pos = plan === "POS";
    return (
      <PlanCard
        plan={plan}
        variant={variant}
        selected={picked.plan === plan}
        onSelect={() => {
          pick(plan, pos ? (picked.plan === "POS" ? picked.trial : true) : false);
          setDetail(null);
        }}
        onOpen={() => setDetail(plan)}
        yearly={yearly}
        prices={prices}
        percent={percent}
        trial={
          pos
            ? {
                offered: trialOffered,
                on: picked.plan === "POS" && picked.trial,
                onToggle: (on) => pick("POS", on),
              }
            : undefined
        }
        savings={savings}
        paid={paid === plan}
        locked={paid !== null && paid !== plan}
        disabled={skipping}
      />
    );
  };

  return (
    <QuestionShell
      direction={direction}
      eyebrow={t("onboarding.flow.welcome.registered").replace("{email}", user.email)}
      title={t("onboarding.flow.welcome.greeting").replace(
        "{name}",
        firstNameOf(user.name, user.email)
      )}
      subtitle={t(paid ? "onboarding.flow.plan.paidSubtitle" : "onboarding.flow.plan.subtitle")}
      onSubmit={onSubmit}
      submitLabel={t(
        picked.trial || paid ? "onboarding.flow.plan.continue" : "onboarding.flow.plan.continuePay"
      )}
      submitIcon="arrow"
      submitDisabled={skipping}
      pending={pending}
      pendingLabel={t("onboarding.flow.plan.paying")}
      onBack={onBack}
      enterToSubmit={false}
      footer={
        <QuietButton onClick={onSkip} disabled={skipping} busy={skipping}>
          {t("onboarding.flow.plan.skip")}
        </QuietButton>
      }
    >
      <PlanBillingToggle
        yearly={interval === "yearly"}
        onYearlyChange={(next) => {
          setInterval(next ? "yearly" : "monthly");
          // The pick follows the toggle, the free trial included: after the trial it is billed at that interval.
          pick(picked.plan, picked.trial, next);
        }}
        currency={prices.currency}
        onCurrencyChange={onCurrency}
        monthlyLabel={t("onboarding.flow.plan.intervalMonthly")}
        yearlyLabel={
          <>
            <span className="sm:hidden">
              {t("onboarding.flow.plan.intervalYearly")} -{savings}%
            </span>
            <span className="hidden sm:inline">
              {t("onboarding.flow.plan.saveYearlyPct").replace("{pct}", String(savings))}
            </span>
          </>
        }
        groupLabel={t("onboarding.flow.plan.title")}
        currencyLabel={t("onboarding.flow.plan.currency")}
        disabled={skipping}
      />

      <div
        role="radiogroup"
        aria-label={t("onboarding.flow.plan.title")}
        className="grid grid-cols-2 gap-3 pt-3 sm:gap-5"
      >
        {renderCard("POS", "card")}
        {renderCard("OPERATIONS", "card")}
      </div>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[calc(100%-2rem)] gap-0 border-0 bg-transparent p-0 shadow-none sm:hidden"
        >
          <DialogTitle className="sr-only">
            {t(
              detail === "OPERATIONS"
                ? "onboarding.flow.plan.opsName"
                : "onboarding.flow.plan.posName"
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(
              detail === "OPERATIONS"
                ? "onboarding.flow.plan.opsTagline"
                : "onboarding.flow.plan.posTagline"
            )}
          </DialogDescription>
          {/* Just a red X, above and outside the card. */}
          <DialogClose
            data-testid="plan-sheet-close"
            aria-label={t("onboarding.actions.close")}
            className="focus-visible:ring-ring/50 absolute -top-12 right-0 flex size-10 items-center justify-center rounded-full text-red-500 outline-none focus-visible:ring-[3px]"
          >
            <X aria-hidden="true" className="size-7" strokeWidth={3} />
          </DialogClose>
          {/* Room above the card for its badge, which hangs over the top edge (the scroll area would crop it). */}
          <div className="max-h-[80dvh] overflow-y-auto pt-4">
            {detail ? renderCard(detail, "sheet") : null}
          </div>
        </DialogContent>
      </Dialog>

      {paid ? null : credited ? (
        <div data-testid="referral-credited" className="space-y-2 rounded-2xl border p-4">
          <label htmlFor="referral-code" className="flex items-center gap-2 text-sm font-medium">
            <BadgePercent aria-hidden="true" className="size-4 text-[var(--epi-gold-600)]" />
            {t("onboarding.flow.plan.referralTitle")}
          </label>
          {/* The partner link this account signed up with: its code is locked in
              and its discount applies until the first payment. */}
          <Input
            id="referral-code"
            value={credited.code}
            readOnly
            disabled
            aria-describedby="referral-code-status"
            className="h-11 font-mono uppercase"
          />
          <p
            id="referral-code-status"
            role="status"
            className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400"
          >
            <Check aria-hidden="true" className="size-4 shrink-0" />
            {t("onboarding.referral.credited")
              .replace("{name}", credited.displayName)
              .replace("{discount}", String(credited.discountPercent))}
          </p>
        </div>
      ) : (
        <ReferralClaim referral={referral} onReferral={onReferral} disabled={skipping} />
      )}
    </QuestionShell>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  yearly,
  prices,
  percent,
  trial,
  paid = false,
  locked = false,
  savings,
  variant = "card",
  onOpen,
  disabled,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  yearly: boolean;
  prices: PosPrices;
  percent: number;
  /** POS only: the free trial, and the link that turns it off / on. */
  trial?: { offered: boolean; on: boolean; onToggle: (on: boolean) => void };
  /** % saved by paying yearly (shown on the free trial, so the discount is clear). */
  savings: number;
  /** The account already paid for this plan: marked as paid, nothing to pick. */
  paid?: boolean;
  /** The account paid for the other plan: this one is dimmed. */
  locked?: boolean;
  /**
   * "card": the plan on the page. On phones the two cards sit side by side and
   * show only the price; tapping one opens its details. "sheet": the full
   * details (shown in that pop-up, and on larger screens in the card itself).
   */
  variant?: "card" | "sheet";
  /** Phones: open this plan's details. */
  onOpen?: () => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const sheet = variant === "sheet";
  const sfx = sheet ? "-sheet" : "";
  // Parts only the details show on a phone (the card itself keeps just the price).
  const more = sheet ? "" : "hidden sm:block";
  const moreFlex = sheet ? "flex" : "hidden sm:flex";
  const pos = plan === "POS";
  const id = pos ? "pos" : "operations";
  const perMonth = pos
    ? yearly
      ? prices.yearlyPerMonth
      : prices.monthly
    : yearly
      ? prices.opsYearlyPerMonth
      : prices.opsMonthly;
  const perMonthAfter = pos
    ? yearly
      ? prices.yearlyPerMonthAfter
      : prices.monthlyAfter
    : yearly
      ? prices.opsYearlyPerMonthAfter
      : prices.opsMonthlyAfter;
  const trialOn = !paid && !!trial?.on;
  const features = pos ? ["posF1", "posF2", "posF3"] : ["opsF0", "opsF1", "opsF2", "opsF3"];
  const cta = pos && trial?.offered && trialOn ? "ctaTrial" : pos ? "ctaPos" : "ctaOps";

  return (
    <div
      data-testid={`plan-${id}${sfx}`}
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl border transition-colors sm:rounded-3xl sm:p-6",
        sheet ? "p-4" : "p-3",
        locked && "opacity-50",
        // The gold border, tint and glow follow the card that is picked.
        selected
          ? cn(
              "border-[var(--epi-gold-500)] bg-[var(--epi-gold-500)]/8",
              // The glow would be cropped by the pop-up's scroll area into a hard-edged box.
              !sheet && "shadow-[0_0_40px_-12px_var(--epi-gold-500)]"
            )
          : "border-border bg-card",
        // In the pop-up the card is the only surface: solid, not see-through.
        sheet && "bg-background"
      )}
    >
      {!sheet ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${t(pos ? "onboarding.flow.plan.posName" : "onboarding.flow.plan.opsName")} · ${t("onboarding.flow.plan.details")}`}
          data-testid={`plan-${id}-open`}
          className="focus-visible:ring-ring/50 absolute inset-0 z-10 rounded-2xl outline-none focus-visible:ring-[3px] sm:hidden"
        />
      ) : null}

      {paid ? (
        <span
          data-testid={`plan-${id}-paid${sfx}`}
          className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-[10px] font-bold tracking-widest whitespace-nowrap text-white uppercase sm:px-4 sm:text-[11px]"
        >
          <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
          {t("onboarding.flow.plan.paid")}
        </span>
      ) : pos && trial?.offered && !locked ? (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--epi-gold-500)] px-3 py-1.5 text-[10px] font-bold tracking-widest whitespace-nowrap text-[var(--epi-navy-900)] uppercase sm:px-4 sm:text-[11px]">
          {t("onboarding.flow.plan.badgeTrial")}
        </span>
      ) : null}

      <div className={cn("flex-wrap items-center gap-2", moreFlex)}>
        <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
          {t(pos ? "onboarding.flow.plan.forPos" : "onboarding.flow.plan.forOps")}
        </p>
        {pos ? (
          <span className="rounded-full border border-[var(--epi-gold-500)]/60 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-[var(--epi-gold-600)] uppercase dark:text-[var(--epi-gold-400)]">
            {t("onboarding.flow.plan.mostPopular")}
          </span>
        ) : null}
      </div>
      <h2
        className={cn(
          "text-foreground font-bold tracking-tight sm:mt-2 sm:text-3xl",
          sheet ? "mt-1.5 text-2xl" : "mt-1 text-lg"
        )}
      >
        {t(pos ? "onboarding.flow.plan.posName" : "onboarding.flow.plan.opsName")}
      </h2>

      {pos && trialOn ? (
        <>
          {/* The free trial is the default: the monthly price is crossed out and the price is FREE. */}
          <p className="mt-3 flex flex-wrap items-center gap-2 sm:mt-5">
            <s
              data-testid={`plan-pos-was${sfx}`}
              className="text-xs font-semibold text-red-500 decoration-2 sm:text-xl"
            >
              {yearly ? prices.yearlyPerMonth : prices.monthly}
            </s>
            <span
              data-testid={`plan-pos-nocard${sfx}`}
              className={cn(
                "rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:text-green-400",
                moreFlex
              )}
            >
              {t("onboarding.flow.plan.trialNoCard")}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1">
            <span
              data-testid={`plan-pos-price${sfx}`}
              className={cn(
                "text-foreground leading-none font-bold tracking-tight uppercase sm:text-5xl",
                sheet ? "text-3xl" : "text-2xl"
              )}
            >
              {t("onboarding.flow.plan.free")}
            </span>
            <span className="text-muted-foreground pb-0.5 text-[10px] sm:pb-1 sm:text-sm">
              {t("onboarding.flow.plan.freeFor")}
            </span>
          </div>
          {yearly ? (
            <p
              data-testid={`plan-pos-save${sfx}`}
              className={cn("mt-1 text-xs font-medium text-green-700 dark:text-green-400", more)}
            >
              {t("onboarding.flow.plan.saveVsMonthly").replace("{pct}", String(savings))}
            </p>
          ) : null}
          {percent > 0 ? (
            <p className={cn("mt-1 text-xs font-medium text-green-700 dark:text-green-400", more)}>
              {t("onboarding.flow.plan.discountNote").replace("{pct}", String(percent))}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {percent > 0 ? (
            <p
              data-testid={`plan-${id}-deal${sfx}`}
              className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-5 sm:gap-2"
            >
              <s className="text-xs font-semibold text-red-500 decoration-2 sm:text-xl">
                {perMonth}
              </s>
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-700 sm:px-2.5 sm:text-xs dark:text-green-400">
                -{percent}%
              </span>
            </p>
          ) : null}
          <div
            className={cn(
              "flex flex-wrap items-end gap-x-2 gap-y-1",
              percent > 0 ? "mt-1" : "mt-2 sm:mt-5"
            )}
          >
            <span
              data-testid={`plan-${id}-price${sfx}`}
              className={cn(
                "text-foreground leading-none font-bold tracking-tight sm:text-5xl",
                sheet ? "text-3xl" : "text-xl"
              )}
            >
              {percent > 0 ? perMonthAfter : perMonth}
            </span>
            <span className="text-muted-foreground pb-0.5 text-[10px] sm:pb-1 sm:text-sm">
              {t("onboarding.flow.plan.perMonth")}
            </span>
          </div>
          <p className={cn("text-muted-foreground mt-1 text-xs", more)}>
            {yearly
              ? t("onboarding.flow.plan.billedYearly").replace(
                  "{total}",
                  pos ? prices.yearlyTotal : prices.opsYearlyTotal
                )
              : t("onboarding.flow.plan.billedMonthly")}
            {" · "}
            {t("onboarding.flow.plan.exTax")}
          </p>
          {percent > 0 ? (
            <p className={cn("mt-1 text-xs font-medium text-green-700 dark:text-green-400", more)}>
              {t("onboarding.flow.plan.discountNote").replace("{pct}", String(percent))}
            </p>
          ) : null}
        </>
      )}

      {pos && trial?.offered && trialOn ? (
        <p
          className={cn(
            "mt-3 w-fit max-w-full rounded-full bg-[var(--epi-gold-500)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--epi-gold-600)] sm:text-sm dark:text-[var(--epi-gold-400)]",
            more
          )}
        >
          🎁{" "}
          {t(
            yearly ? "onboarding.flow.plan.chipTrialYearly" : "onboarding.flow.plan.chipTrial"
          ).replace("{price}", yearly ? prices.yearlyPerMonth : prices.monthly)}
        </p>
      ) : (
        <div className="mt-1 h-0" />
      )}

      <button
        type="button"
        role="radio"
        aria-checked={selected}
        data-testid={`plan-${id}-select${sfx}`}
        disabled={disabled || paid || locked}
        onClick={onSelect}
        className={cn(
          "mt-4 h-11 items-center justify-center gap-2 rounded-full text-xs font-bold tracking-widest uppercase transition-colors outline-none sm:mt-5 sm:flex sm:h-12 sm:text-sm",
          sheet ? "flex" : "hidden",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60",
          paid
            ? "bg-green-600 text-white disabled:opacity-100"
            : selected
              ? "bg-gradient-to-b from-[var(--epi-gold-400)] to-[var(--epi-gold-600)] text-[var(--epi-navy-900)]"
              : "border-border hover:bg-accent border"
        )}
      >
        {selected ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : null}
        {paid ? t("onboarding.flow.plan.paid") : t(`onboarding.flow.plan.${cta}`)}
      </button>
      {pos && trial?.offered && !paid && !locked ? (
        <button
          type="button"
          data-testid={`trial-toggle${sfx}`}
          disabled={disabled}
          onClick={() => trial.onToggle(!trialOn)}
          className={cn(
            "text-muted-foreground hover:text-foreground mt-2 min-h-10 rounded-lg text-xs underline-offset-2 hover:underline",
            more
          )}
        >
          {t(trialOn ? "onboarding.flow.plan.payInstead" : "onboarding.flow.plan.trialInstead")}
        </button>
      ) : null}
      {!(pos && trialOn) && !paid && !locked ? (
        <p className={cn("text-muted-foreground mt-2 text-center text-xs", more)}>
          {t("onboarding.flow.plan.paysNow")}
        </p>
      ) : null}

      <ul
        className={cn(
          "border-border mt-4 space-y-1.5 border-t pt-3 text-xs sm:mt-5 sm:space-y-2 sm:pt-4 sm:text-sm",
          more
        )}
      >
        {features.map((key, index) => (
          <li
            key={key}
            className={cn(
              "flex items-start gap-2",
              !pos && index === 0 ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {!pos && index === 0 ? null : (
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[var(--epi-gold-600)]"
              />
            )}
            <span>{t(`onboarding.flow.plan.${key}`)}</span>
          </li>
        ))}
      </ul>
      {!sheet ? (
        <span className="text-muted-foreground mt-2 flex items-center gap-1 text-[10px] sm:hidden">
          <Info aria-hidden="true" className="size-3" />
          {t("onboarding.flow.plan.details")}
        </span>
      ) : null}
    </div>
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
        <BadgePercent aria-hidden="true" className="size-4 text-[var(--epi-gold-600)]" />
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
