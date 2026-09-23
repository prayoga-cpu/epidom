"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUser } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, trackConversion, trackMetaPixelEvent } from "@/lib/analytics";
import { getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { BoldText } from "./bold-text";

const TIERS = [
  { idx: 0, key: "t1", highlight: false, promo: false, plan: "FREE" },
  // POS is the hero: special 14-day free-trial promo (animated).
  { idx: 1, key: "t2", highlight: true, promo: true, plan: "POS" },
  { idx: 2, key: "t3", highlight: false, promo: false, plan: "OPERATIONS" },
  { idx: 3, key: "t4", highlight: false, promo: false, plan: "ENTERPRISE" },
] as const;

// Free lists 5 features: it has no POS or KDS (the till is gated to the POS plan),
// so the old sixth line "POS + KDS" was wrong and is gone from the locales.
const FEAT_COUNTS = [5, 6, 8, 7] as const;

const FREE_PRICES = new Set(["$0", "0 €", "Rp 0", "€0"]);
const CUSTOM_PRICES = new Set(["Custom", "Sur devis", "Kustom"]);

// What Tab can land on inside the confirm dialog.
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PricingCards({
  yearly,
  currentPlan,
}: {
  yearly: boolean;
  currentPlan?: string | null;
}) {
  const { t, locale } = useI18n();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [confirming, setConfirming] = useState<{
    key: string;
    plan: string;
    name: string;
    trial?: boolean;
  } | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The CTA that opened the dialog, so focus goes back to it on close.
  const triggerRef = useRef<HTMLElement | null>(null);
  const isOpen = confirming !== null;

  // The 14-day trial is POS-only and first-time-only, and the checkout route
  // decides it server-side (it ignores the flag sent from here). This is the
  // client-side floor: never offer a trial to someone already on a paid plan.
  // A visitor who once subscribed and lapsed back to FREE still reads as
  // eligible here; only the server knows their Stripe history.
  const trialEligible = !currentPlan || currentPlan === "FREE";
  // A dialog opened while the plan was still loading shows the trial copy until
  // the plan arrives, so eligibility is applied at render, not only at open.
  const dialogTrial = !!confirming?.trial && trialEligible;

  useEffect(() => {
    if (!userLoading && user && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("trial") === "true") {
        window.history.replaceState({}, "", window.location.pathname);
        // Already on POS: there is nothing to start or switch to.
        if (currentPlan === "POS") return;
        setErrorMsg(null);
        // No click opened this one; hand focus back to the POS card's CTA.
        triggerRef.current =
          sectionRef.current?.querySelector<HTMLElement>('[data-plan="POS"] button') ?? null;
        setConfirming({
          key: "t2",
          plan: "POS",
          name: t("redesign.pricingPage.t2name") as string,
          trial: true,
        });
      }
    }
  }, [user, userLoading, t, currentPlan]);

  // Focus moves into the dialog when it opens and back to the CTA that opened it
  // when it closes.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    (dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog)?.focus();
    return () => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [isOpen]);

  // Escape closes (unless a request is in flight, like the backdrop and Cancel);
  // Tab cycles inside the dialog. Listening on the document rather than on the
  // dialog keeps the trap working when focus is on <body>, which is where it
  // lands when the focused button is disabled during an activation.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (e.key === "Escape") {
        if (!isActivating) {
          e.preventDefault();
          setConfirming(null);
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isActivating]);

  /**
   * Where a visitor who is not signed in goes to sign up. The sign-up form (and
   * the verify-email flow after it) reads `next`, not `callbackURL`, so the
   * pricing page and trial intent ride in `next`, encoded so the "?" inside it
   * does not split the value. FREE has no intent to keep.
   */
  function registerHref(plan: string, trial?: boolean) {
    if (plan === "FREE") return "/register";
    const back =
      getLocalizedPath("/pricing", locale) + (plan === "POS" && trial ? "?trial=true" : "");
    return `/register?next=${encodeURIComponent(back)}`;
  }

  function getPrice(tierKey: string) {
    const mo = t(`redesign.pricingPage.${tierKey}price_mo` as const);
    const yr = t(`redesign.pricingPage.${tierKey}price_yr` as const);
    return yearly ? yr : mo;
  }

  function isFree(price: string) {
    return FREE_PRICES.has(price);
  }
  function isCustom(price: string) {
    return CUSTOM_PRICES.has(price);
  }

  function getBilling(tierKey: string) {
    const price = getPrice(tierKey);
    if (isFree(price)) return t("redesign.pricingPage.freeForever");
    if (isCustom(price)) return t("redesign.pricingPage.talkSales");
    return yearly
      ? t("redesign.pricingPage.billedYearly")
      : t("redesign.pricingPage.billedMonthly");
  }

  function handleCta(tierKey: string, plan: string, trial?: boolean, trigger?: HTMLElement | null) {
    if (plan === currentPlan) return;
    trackEvent("cta_click", { event_category: "engagement", event_label: `pricing_${tierKey}` });
    if (tierKey === "t4") {
      const waOptions = getWhatsAppOptions(locale);
      if (waOptions.length === 1) {
        trackConversion("contact_whatsapp", { event_label: "pricing_enterprise" });
        window.open(whatsappHref(waOptions[0].number), "_blank");
      } else {
        // Worldwide (en): more than one real number to choose from — send
        // to the contact page, which lists each market's WhatsApp option,
        // rather than guessing which one this visitor wants. No WhatsApp has
        // opened yet, so no contact_whatsapp here: the contact page fires it
        // when the visitor actually picks a number (the cta_click above still
        // records this click).
        router.push(getLocalizedPath("/contact", locale));
      }
      return;
    }
    // Once auth has resolved with nobody signed in there is no subscription to
    // "switch": skip the confirm dialog (its wording assumes an existing plan and
    // its checkout call would only 401) and go to sign-up carrying the intent.
    if (!userLoading && !user) {
      window.location.href = registerHref(plan, trial);
      return;
    }
    const name = t(`redesign.pricingPage.${tierKey}name` as const);
    triggerRef.current = trigger ?? null;
    setErrorMsg(null);
    setConfirming({ key: tierKey, plan, name, trial });
  }

  async function confirmActivate() {
    if (!confirming) return;
    setIsActivating(true);
    setErrorMsg(null);
    try {
      const isPaid = confirming.plan === "POS" || confirming.plan === "OPERATIONS";
      const endpoint = isPaid ? "/api/subscriptions/checkout" : "/api/subscriptions/activate-free";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: confirming.plan, trial: dialogTrial || undefined, yearly }),
      });

      if (res.status === 401) {
        // The session lapsed after the dialog opened: same sign-up hand-off as a
        // signed-out click, so the plan intent survives.
        window.location.href = registerHref(confirming.plan, dialogTrial);
        return;
      }

      if (res.ok) {
        if (isPaid) {
          const result = await res.json();
          if (result?.success && result?.data?.url) {
            trackConversion("begin_checkout", {
              event_label: confirming.plan,
              plan: confirming.plan,
              trial: dialogTrial,
              billing_interval: yearly ? "yearly" : "monthly",
            });
            // Standard Meta event for entering a paid checkout flow — lets
            // Meta optimize/retarget against real checkout starts instead of
            // just clicks. content_category distinguishes trial vs.
            // immediate-pay checkouts for campaign reporting.
            trackMetaPixelEvent("InitiateCheckout", {
              content_name: confirming.plan,
              content_category: dialogTrial ? "trial" : "paid",
            });
            window.location.href = result.data.url;
            setConfirming(null);
          } else {
            setErrorMsg(result?.error?.message || t("redesign.pricingPage.errCheckoutStart"));
            setIsActivating(false);
          }
        } else {
          trackConversion("free_plan_activated", { event_label: confirming.plan });
          // No exact Meta standard event for "activated a free plan" — Lead
          // is the closest real fit (a qualified, engaged user with no
          // payment yet) and lets Meta optimize toward it, rather than a
          // fully custom event Meta's algorithm has no prior signal for.
          trackMetaPixelEvent("Lead", { content_name: confirming.plan });
          // Full navigation to flush React Query cache so new plan reflects immediately
          window.location.href = "/stores";
        }
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMsg(errorData?.error?.message || t("redesign.pricingPage.errCheckout"));
        setIsActivating(false);
      }
    } catch {
      setErrorMsg(t("redesign.pricingPage.errNetwork"));
      setIsActivating(false);
    }
  }

  // The trial promo (animated glow, badge, note, CTA) only for a visitor who can
  // still start a trial; otherwise POS is a plain highlighted plan.
  const tiers = TIERS.map((tier) => ({ ...tier, trialOffer: tier.promo && trialEligible }));

  return (
    <>
      <style>{`
        @keyframes epiPromoGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(217,174,59,0.55), 0 0 22px rgba(217,174,59,0.16); }
          50%      { box-shadow: 0 0 0 1px rgba(217,174,59,0.90), 0 0 42px rgba(217,174,59,0.40); }
        }
        @keyframes epiPromoBadge {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50%      { transform: translateX(-50%) scale(1.05); }
        }
        .epi-promo-card { animation: epiPromoGlow 2.6s ease-in-out infinite; }
        .epi-promo-badge { animation: epiPromoBadge 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .epi-promo-card, .epi-promo-badge { animation: none !important; }
        }
      `}</style>
      <section id="plans" ref={sectionRef} style={{ padding: "40px 0 80px", scrollMarginTop: 20 }}>
        <div className="epi-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 14 }}>
            {tiers.map(({ idx, key, highlight, trialOffer, plan }) => (
              <div
                key={key}
                data-plan={plan}
                className={trialOffer ? "epi-promo-card" : undefined}
                style={{
                  position: "relative",
                  padding: 30,
                  borderRadius: 24,
                  background: trialOffer
                    ? "linear-gradient(160deg, rgba(217,174,59,0.26), rgba(217,174,59,0.05))"
                    : highlight
                      ? "linear-gradient(160deg, rgba(217,174,59,0.18), rgba(217,174,59,0.04))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid",
                  borderColor: trialOffer
                    ? "var(--epi-gold-500)"
                    : highlight
                      ? "rgba(217,174,59,0.45)"
                      : "rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {trialOffer ? (
                  <div
                    className="epi-promo-badge"
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "var(--epi-gold-500)",
                      color: "var(--epi-navy-900)",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("redesign.pricingPage.trialBadge")}
                  </div>
                ) : (
                  highlight && (
                    <div
                      style={{
                        position: "absolute",
                        top: -14,
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "6px 14px",
                        borderRadius: 999,
                        background: "var(--epi-gold-500)",
                        color: "var(--epi-navy-900)",
                        fontSize: 11,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t("redesign.pricingPage.mostPopular")}
                    </div>
                  )
                )}

                <div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "var(--epi-cream-50)",
                        opacity: 0.4,
                      }}
                    >
                      {t(`redesign.pricingPage.${key}tag` as const)}
                    </span>
                    {/* The one "most popular" mark on the page. On the POS card the ribbon
                        above is taken by the trial badge, so the mark sits beside the tag. */}
                    {trialOffer && highlight && (
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: "rgba(217,174,59,0.16)",
                          border: "1px solid rgba(217,174,59,0.45)",
                          color: "var(--epi-gold-300)",
                          fontSize: 10,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("redesign.pricingPage.mostPopular")}
                      </span>
                    )}
                  </div>
                  <div
                    className="epi-display"
                    style={{
                      fontSize: 36,
                      letterSpacing: "0.04em",
                      color: "var(--epi-cream-50)",
                      lineHeight: 1,
                    }}
                  >
                    {t(`redesign.pricingPage.${key}name` as const)}
                  </div>
                  <div
                    style={{
                      color: "var(--epi-cream-50)",
                      opacity: 0.6,
                      fontSize: 13,
                      marginTop: 8,
                      lineHeight: 1.5,
                      // Reserve 2 lines' worth of height so a short tagline (1 line)
                      // doesn't leave the CTA button sitting higher than cards whose
                      // tagline wraps to 2 lines.
                      minHeight: 39,
                    }}
                  >
                    {t(`redesign.pricingPage.${key}tagline` as const)}
                  </div>
                </div>

                <div style={{ minHeight: 115 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span
                      className="epi-display"
                      style={{
                        fontSize: isCustom(getPrice(key)) ? 32 : 56,
                        color: "var(--epi-cream-50)",
                        letterSpacing: "0.01em",
                        lineHeight: 1,
                      }}
                    >
                      {getPrice(key)}
                    </span>
                    {!isCustom(getPrice(key)) && !isFree(getPrice(key)) && (
                      <span style={{ color: "var(--epi-cream-50)", opacity: 0.5, fontSize: 13 }}>
                        {t("redesign.pricingPage.perMonthShort")}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--epi-cream-50)",
                      opacity: 0.4,
                      marginTop: 4,
                    }}
                  >
                    {getBilling(key)}
                  </div>
                  {trialOffer && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 999,
                        background: "rgba(217,174,59,0.16)",
                        color: "var(--epi-gold-400)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      🎁{" "}
                      {yearly
                        ? t("redesign.pricingPage.promoTrialNoteYearly")
                        : t("redesign.pricingPage.promoTrialNote")}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => handleCta(key, plan, trialOffer || undefined, e.currentTarget)}
                  disabled={isActivating || plan === currentPlan}
                  className="cursor-pointer transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: 999,
                    background: highlight ? "var(--epi-gold-500)" : "transparent",
                    color: highlight ? "var(--epi-navy-900)" : "var(--epi-cream-50)",
                    border: `1px solid ${highlight ? "transparent" : "rgba(255,255,255,0.18)"}`,
                    fontSize: 14,
                    fontWeight: trialOffer ? 700 : 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "var(--epi-font-body)",
                  }}
                >
                  {plan === currentPlan
                    ? t("redesign.pricingPage.currentPlanCta")
                    : trialOffer
                      ? t("redesign.pricingPage.startTrialCta")
                      : currentPlan === "FREE" && plan === "OPERATIONS"
                        ? t("redesign.pricingPage.upgradeCta")
                        : currentPlan && key !== "t4"
                          ? t("redesign.pricingPage.switchPlanCta")
                          : t(`redesign.pricingPage.${key}cta` as const)}
                </button>

                <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: FEAT_COUNTS[idx] }, (_, n) => {
                    const featKey = `redesign.pricingPage.${key}f${n + 1}` as Parameters<
                      typeof t
                    >[0];
                    const text = t(featKey);
                    const included = !text.startsWith("redesign.");
                    return (
                      <div
                        key={n}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: included ? "var(--epi-cream-50)" : "rgba(251,249,228,0.25)",
                          fontSize: 13,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                          {included ? (
                            <>
                              <circle cx="8" cy="8" r="7" fill="rgba(217,174,59,0.16)" />
                              <path
                                d="M5 8l2 2 4-4"
                                stroke="var(--epi-gold-400)"
                                strokeWidth="1.6"
                                fill="none"
                              />
                            </>
                          ) : (
                            <circle
                              cx="8"
                              cy="8"
                              r="7"
                              fill="none"
                              stroke="rgba(255,255,255,0.08)"
                            />
                          )}
                        </svg>
                        {included ? text : "—"}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Trial bar: hidden for a current paid plan, which can't start the trial. */}
          {trialEligible && (
            <div
              style={{
                marginTop: 32,
                padding: "20px 28px",
                borderRadius: 16,
                background: "rgba(91,136,178,0.10)",
                border: "1px solid rgba(91,136,178,0.30)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  className="epi-display"
                  style={{ fontSize: 22, letterSpacing: "0.04em", color: "var(--epi-cream-50)" }}
                >
                  {t("redesign.pricingPage.trialBar")}
                </div>
                <div
                  style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 14, marginTop: 4 }}
                >
                  {t("redesign.pricingPage.trialBarSub")}
                </div>
              </div>
              <button
                onClick={(e) => {
                  if (!userLoading && !user) {
                    trackEvent("cta_click", {
                      event_category: "engagement",
                      event_label: "pricing_trial_bar",
                    });
                    window.location.href = registerHref("POS", true);
                  } else {
                    handleCta("t2", "POS", true, e.currentTarget);
                  }
                }}
                className="cursor-pointer transition-all hover:-translate-y-px"
                style={{
                  padding: "12px 28px",
                  borderRadius: 999,
                  background: "var(--epi-cream-50)",
                  color: "var(--epi-navy-900)",
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  border: "none",
                  fontFamily: "var(--epi-font-body)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("redesign.pricingPage.trialBarCta")}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Confirmation dialog */}
      {confirming && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => !isActivating && setConfirming(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-confirm-title"
            // Focusable so focus has somewhere to sit when both buttons are disabled
            // mid-request; the ring is off because it is only ever a fallback.
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              outline: "none",
              background: "var(--epi-navy-800, #0f1f38)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "36px 32px",
              maxWidth: 420,
              width: "90%",
              // dvh, not vh: iOS Safari's vh ignores the address bar, which would push
              // the buttons off-screen on a short phone in landscape.
              maxHeight: "calc(90dvh / var(--app-zoom, 1))",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--epi-cream-50)",
                  opacity: 0.4,
                  marginBottom: 8,
                }}
              >
                {t("redesign.pricingPage.dlgEyebrow")}
              </div>
              <div
                id="pricing-confirm-title"
                className="epi-display"
                style={{ fontSize: 28, color: "var(--epi-cream-50)", letterSpacing: "0.04em" }}
              >
                {t(
                  dialogTrial
                    ? "redesign.pricingPage.dlgTrialTitle"
                    : "redesign.pricingPage.dlgSwitchTitle"
                ).replace("{name}", confirming.name)}
              </div>
              <p
                style={{
                  color: "var(--epi-cream-50)",
                  opacity: 0.6,
                  fontSize: 14,
                  marginTop: 10,
                  lineHeight: 1.6,
                }}
              >
                <BoldText
                  text={t(
                    dialogTrial
                      ? "redesign.pricingPage.dlgTrialBody"
                      : "redesign.pricingPage.dlgSwitchBody"
                  ).replace("{name}", confirming.name)}
                />
              </p>
              {errorMsg && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(220, 38, 38, 0.1)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    color: "rgb(252, 165, 165)",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ lineHeight: 1.5 }}>{errorMsg}</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirming(null)}
                disabled={isActivating}
                style={{
                  flex: 1,
                  padding: "13px 0",
                  borderRadius: 999,
                  background: "transparent",
                  color: "var(--epi-cream-50)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--epi-font-body)",
                  cursor: "pointer",
                  opacity: isActivating ? 0.5 : 1,
                }}
              >
                {t("redesign.pricingPage.dlgCancel")}
              </button>
              <button
                onClick={confirmActivate}
                disabled={isActivating}
                style={{
                  flex: 1,
                  padding: "13px 0",
                  borderRadius: 999,
                  background: "var(--epi-gold-500)",
                  color: "var(--epi-navy-900)",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--epi-font-body)",
                  cursor: isActivating ? "not-allowed" : "pointer",
                  opacity: isActivating ? 0.6 : 1,
                }}
              >
                {isActivating
                  ? t("redesign.pricingPage.dlgActivating")
                  : t("redesign.pricingPage.dlgConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
