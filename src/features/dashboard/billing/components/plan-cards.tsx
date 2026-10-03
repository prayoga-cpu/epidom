"use client";

import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Boxes, Building2, Check, Loader2, MonitorSmartphone } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAN_PRICING, type PriceCurrency } from "@/lib/constants/plan-pricing";
import { getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { formatCurrency } from "@/lib/utils/formatting";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { trackConversion, trackMetaPixelEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { isPaidPlan, yearlySavingsPercent } from "../lib/plan-price";

/**
 * How a plan change is carried out for this account:
 * - "checkout": no paid Stripe subscription yet — a new Stripe Checkout.
 * - "portal": already paying through Stripe — /api/subscriptions/checkout
 *   answers with a Customer Portal session, where the change and its
 *   proration are handled.
 * - "beta": admin-granted account with no payment method — switches
 *   instantly through /api/subscriptions/beta-plan.
 */
export type PlanChangeMode = "checkout" | "portal" | "beta";

// The plans the billing page offers. FREE is not a card: leaving a paid plan
// is Cancel Subscription, and a FREE account sees its plan in Current Plan.
// `tier` is the marketing locale prefix the name, tagline and feature list are
// read from (redesign.pricingPage.t2name, ...), so /pricing and this page can't
// drift apart.
const PLANS = [
  { plan: "POS", tier: "t2", Icon: MonitorSmartphone },
  { plan: "OPERATIONS", tier: "t3", Icon: Boxes },
  { plan: "ENTERPRISE", tier: "t4", Icon: Building2 },
] as const;

type OfferedPlan = (typeof PLANS)[number]["plan"];

const PLAN_RANK: Record<string, number> = { FREE: 0, POS: 1, OPERATIONS: 2, ENTERPRISE: 3 };

// Generous upper bound on a tier's feature lines; the list stops at the first
// key the locale doesn't have.
const MAX_FEATURES = 12;

type PendingChange = {
  plan: OfferedPlan;
  name: string;
  kind: "checkout" | "trial" | "portal" | "beta";
};

export function PlanCards({
  currentPlan,
  mode,
  currency,
}: {
  currentPlan: string;
  mode: PlanChangeMode;
  currency: PriceCurrency;
}) {
  const { t, locale, intlLocale } = useI18n();
  const pathname = usePathname();
  const [yearly, setYearly] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // The 14-day POS trial is first-time-only and decided server-side; this is
  // only the floor for offering it (same as /pricing).
  const trialEligible = mode === "checkout" && currentPlan === "FREE";
  const whatsAppOptions = getWhatsAppOptions(locale);
  const money = (amount: number) => formatCurrency(amount, currency, intlLocale);
  const tierText = (tier: string, field: string) => t(`redesign.pricingPage.${tier}${field}`);
  const currentName = tierText(PLANS.find((p) => p.plan === currentPlan)?.tier ?? "t1", "name");

  function features(tier: string): string[] {
    const lines: string[] = [];
    for (let n = 1; n <= MAX_FEATURES; n++) {
      const key = `redesign.pricingPage.${tier}f${n}`;
      const text = t(key);
      if (text === key) break;
      lines.push(text);
    }
    return lines;
  }

  function openChange(plan: OfferedPlan, name: string) {
    setDialogError(null);
    setPending({
      plan,
      name,
      kind: mode === "checkout" && plan === "POS" && trialEligible ? "trial" : mode,
    });
  }

  function contactSales(number: string) {
    trackConversion("contact_whatsapp", { event_label: "billing_enterprise" });
    window.open(
      whatsappHref(number, t("billing.planCards.enterpriseMessage")),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function confirmChange() {
    if (!pending) return;
    setSubmitting(true);
    setDialogError(null);
    const failed = t(
      pending.kind === "beta" ? "billing.planCards.errorSwitch" : "billing.planCards.errorCheckout"
    );
    try {
      if (pending.kind === "beta") {
        const res = await fetch("/api/subscriptions/beta-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: pending.plan }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(getApiErrorMessage(data, failed));
        // Full reload: the plan gates every cached query in the dashboard.
        window.location.reload();
        return;
      }

      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: pending.plan,
          yearly,
          trial: pending.kind === "trial" || undefined,
          // Charge in the currency these cards quote, not the one Stripe would
          // pick from the visitor's IP (IDR from Indonesia, where PayPal is
          // never offered).
          currency,
          // Backing out of Stripe lands here, not on the website's
          // /checkout/failed page. Success keeps the default /checkout/success,
          // which records the trial / paid conversion.
          cancelUrl: `${window.location.origin}${pathname}`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.data?.url) throw new Error(getApiErrorMessage(data, failed));

      if (pending.kind !== "portal") {
        trackConversion("begin_checkout", {
          event_label: pending.plan,
          plan: pending.plan,
          trial: pending.kind === "trial",
          billing_interval: yearly ? "yearly" : "monthly",
          source: "billing",
        });
        trackMetaPixelEvent("InitiateCheckout", {
          content_name: pending.plan,
          content_category: pending.kind === "trial" ? "trial" : "paid",
        });
      }
      window.location.href = data.data.url;
    } catch (err) {
      setDialogError(
        err instanceof TypeError
          ? t("billing.planCards.errorNetwork")
          : err instanceof Error
            ? err.message
            : failed
      );
      setSubmitting(false);
    }
  }

  const dialogBody = (() => {
    if (!pending) return "";
    const interval = yearly ? "Yearly" : "Monthly";
    const fill = (key: string) =>
      t(key).replace("{name}", pending.name).replace("{current}", currentName);
    switch (pending.kind) {
      case "beta":
        return fill("billing.planCards.betaBody");
      case "portal":
        return fill("billing.planCards.portalBody");
      case "trial":
        return fill(`billing.planCards.trialBody${interval}`);
      case "checkout":
        return [
          fill(`billing.planCards.checkoutBody${interval}`),
          currentPlan !== "FREE" ? fill("billing.planCards.replacesPlan") : null,
        ]
          .filter(Boolean)
          .join(" ");
    }
  })();

  const savings = yearlySavingsPercent(currency);

  return (
    <section id="plans" aria-labelledby="plans-title" className="@container scroll-mt-6 space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="space-y-1.5">
          <h2 id="plans-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("billing.planCards.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("billing.planCards.subtitle")}</p>
        </div>

        <div
          role="radiogroup"
          aria-label={t("billing.planCards.intervalLabel")}
          className="bg-muted inline-flex rounded-full border p-1"
        >
          {[false, true].map((isYearly) => (
            <button
              key={String(isYearly)}
              type="button"
              role="radio"
              aria-checked={yearly === isYearly}
              onClick={() => setYearly(isYearly)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium transition-colors",
                yearly === isYearly
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isYearly ? t("billing.planCards.yearly") : t("billing.planCards.monthly")}
              {isYearly && (
                <>
                  {" "}
                  <span className="text-primary">
                    · {t("billing.planCards.save").replace("{percent}", String(savings))}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Subgrid rows line up every card's divider and button across a row,
          whatever the length of each tagline or price. */}
      <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {PLANS.map(({ plan, tier, Icon }) => {
          const name = tierText(tier, "name");
          const isCurrent = plan === currentPlan;
          const [heading, ...included] = features(tier);
          const isUpgrade = PLAN_RANK[plan] > (PLAN_RANK[currentPlan] ?? 0);
          const isTrial = plan === "POS" && trialEligible;
          // Enterprise is quoted per account, so it is a conversation — unless
          // this is a BETA account, which can switch to anything.
          const isContact = plan === "ENTERPRISE" && mode !== "beta";
          const price = isPaidPlan(plan) ? PLAN_PRICING[plan][currency] : null;

          const actionLabel = isCurrent
            ? t("billing.planCards.currentPlan")
            : isContact
              ? t("billing.planCards.talkToUs")
              : isTrial
                ? t("billing.planCards.startTrial")
                : t(
                    isUpgrade ? "billing.planCards.upgradeTo" : "billing.planCards.downgradeTo"
                  ).replace("{name}", name);

          const note = isCurrent
            ? null
            : isTrial
              ? t(`redesign.pricingPage.${yearly ? "promoTrialNoteYearly" : "promoTrialNote"}`)
              : price && mode !== "beta"
                ? t("billing.planCards.cancelAnytime")
                : null;

          const actionClass = "h-11 w-full text-base";
          const action = isCurrent ? (
            <Button variant="outline" disabled className={actionClass}>
              {actionLabel}
            </Button>
          ) : isContact && whatsAppOptions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className={actionClass}>{actionLabel}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-(--radix-dropdown-menu-trigger-width)"
              >
                {whatsAppOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.number}
                    className="min-h-10"
                    onSelect={() => contactSales(option.number)}
                  >
                    {t("billing.planCards.whatsappOption").replace("{label}", option.label)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : isContact ? (
            <Button className={actionClass} onClick={() => contactSales(whatsAppOptions[0].number)}>
              {actionLabel}
            </Button>
          ) : (
            <Button
              variant={isUpgrade ? "default" : "outline"}
              className={actionClass}
              onClick={() => openChange(plan, name)}
            >
              {actionLabel}
            </Button>
          );

          return (
            <div
              key={plan}
              data-plan={plan}
              className={cn(
                "bg-card text-card-foreground row-span-2 grid grid-rows-subgrid gap-0 rounded-2xl border shadow-sm",
                isCurrent && "border-primary/60 ring-primary/20 ring-1",
                plan === "ENTERPRISE" && "@xl:col-span-2 @4xl:col-span-1"
              )}
            >
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <Icon className="size-10 stroke-[1.25]" aria-hidden />
                  {isCurrent && (
                    <Badge variant="secondary">{t("billing.planCards.currentPlan")}</Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl font-semibold">{name}</h3>
                  <p className="text-muted-foreground text-sm">{tierText(tier, "tagline")}</p>
                </div>

                <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums">
                    {price
                      ? money(yearly ? price.yearly : price.monthly)
                      : tierText(tier, "price_mo")}
                  </span>
                  <span className="text-muted-foreground pb-1 text-xs leading-snug">
                    {price ? (
                      <>
                        {t("billing.planCards.perMonth").replace("{currency}", currency)}
                        <br />
                        {yearly
                          ? t("billing.planCards.billedYearly").replace(
                              "{amount}",
                              money(Math.round(price.yearly * 12 * 100) / 100)
                            )
                          : t("billing.planCards.billedMonthly")}
                      </>
                    ) : (
                      t("billing.planCards.customPriceNote")
                    )}
                  </span>
                </div>

                {/* The note line is always there, empty or not, so every
                    card's button sits at the same height. */}
                <div className="mt-auto space-y-2">
                  {action}
                  <p className="text-muted-foreground min-h-4 text-center text-xs">{note}</p>
                </div>
              </div>

              <div className="border-t p-5 sm:p-6">
                {heading && <p className="text-sm font-medium">{heading}</p>}
                <ul className="mt-3 space-y-2.5">
                  {included.map((line) => (
                    <li key={line} className="flex gap-2.5 text-sm">
                      <Check className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-center text-xs">{t("billing.planCards.taxNote")}</p>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !submitting && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending &&
                t(
                  pending.kind === "trial"
                    ? "billing.planCards.trialTitle"
                    : "billing.planCards.confirmTitle"
                ).replace("{name}", pending.name)}
            </AlertDialogTitle>
            <AlertDialogDescription>{dialogBody}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialogError && (
            <p role="alert" className="text-destructive text-sm">
              {dialogError}
            </p>
          )}
          <AlertDialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setPending(null)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={submitting} onClick={confirmChange} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending?.kind === "beta"
                ? t("billing.planCards.switchNow")
                : t("billing.planCards.continueToStripe")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
