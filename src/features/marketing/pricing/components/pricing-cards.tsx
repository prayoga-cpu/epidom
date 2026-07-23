"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUser } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, trackConversion } from "@/lib/analytics";

const TIERS = [
  { idx: 0, key: "t1", highlight: false, promo: false, plan: "FREE" },
  // POS is the hero: special 14-day free-trial promo (animated).
  { idx: 1, key: "t2", highlight: true, promo: true, plan: "POS" },
  { idx: 2, key: "t3", highlight: false, promo: false, plan: "OPERATIONS" },
  { idx: 3, key: "t4", highlight: false, promo: false, plan: "ENTERPRISE" },
] as const;

const FEAT_COUNTS = [6, 6, 8, 9] as const;

const FREE_PRICES = new Set(["$0", "0 €", "Rp 0", "€0"]);
const CUSTOM_PRICES = new Set(["Custom", "Sur devis", "Kustom"]);

export function PricingCards({
  yearly,
  currentPlan,
}: {
  yearly: boolean;
  currentPlan?: string | null;
}) {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();

  const [confirming, setConfirming] = useState<{
    key: string;
    plan: string;
    name: string;
    trial?: boolean;
  } | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && user && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("trial") === "true") {
        setErrorMsg(null);
        setConfirming({
          key: "t2",
          plan: "POS",
          name: t("redesign.pricingPage.t2name") as string,
          trial: true,
        });
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [user, userLoading, t]);

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

  function handleCta(tierKey: string, plan: string, trial?: boolean) {
    if (plan === currentPlan) return;
    trackEvent("cta_click", { event_category: "engagement", event_label: `pricing_${tierKey}` });
    if (tierKey === "t4") {
      trackConversion("contact_whatsapp", { event_label: "pricing_enterprise" });
      window.open("https://wa.me/33781732386", "_blank");
      return;
    }
    const name = t(`redesign.pricingPage.${tierKey}name` as const);
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
        body: JSON.stringify({ plan: confirming.plan, trial: confirming.trial, yearly }),
      });

      if (res.status === 401) {
        window.location.href = "/register";
        return;
      }

      if (res.ok) {
        if (isPaid) {
          const result = await res.json();
          if (result?.success && result?.data?.url) {
            trackConversion("begin_checkout", {
              event_label: confirming.plan,
              plan: confirming.plan,
              trial: confirming.trial ?? false,
              billing_interval: yearly ? "yearly" : "monthly",
            });
            window.location.href = result.data.url;
            setConfirming(null);
          } else {
            setErrorMsg(
              result?.error?.message ||
                "Failed to initiate checkout. Please check Stripe configuration."
            );
            setIsActivating(false);
          }
        } else {
          trackConversion("free_plan_activated", { event_label: confirming.plan });
          // Full navigation to flush React Query cache so new plan reflects immediately
          window.location.href = "/stores";
        }
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMsg(
          errorData?.error?.message || "An error occurred during checkout. Please try again."
        );
        setIsActivating(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "A network error occurred. Please try again.");
      setIsActivating(false);
    }
  }

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
      <section id="plans" style={{ padding: "40px 0 80px", scrollMarginTop: 20 }}>
        <div className="epi-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 14 }}>
            {TIERS.map(({ idx, key, highlight, promo, plan }) => (
              <div
                key={key}
                className={promo ? "epi-promo-card" : undefined}
                style={{
                  position: "relative",
                  padding: 30,
                  borderRadius: 24,
                  background: promo
                    ? "linear-gradient(160deg, rgba(217,174,59,0.26), rgba(217,174,59,0.05))"
                    : highlight
                      ? "linear-gradient(160deg, rgba(217,174,59,0.18), rgba(217,174,59,0.04))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid",
                  borderColor: promo
                    ? "var(--epi-gold-500)"
                    : highlight
                      ? "rgba(217,174,59,0.45)"
                      : "rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {promo ? (
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
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--epi-cream-50)",
                      opacity: 0.4,
                      marginBottom: 10,
                    }}
                  >
                    {t(`redesign.pricingPage.${key}tag` as const)}
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
                    }}
                  >
                    {t(`redesign.pricingPage.${key}tagline` as const)}
                  </div>
                </div>

                <div>
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
                        /mo
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
                  {promo && (
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
                      🎁 {t("redesign.pricingPage.promoTrialNote")}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleCta(key, plan, promo || undefined)}
                  disabled={isActivating || plan === currentPlan}
                  className="cursor-pointer transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: 999,
                    background: promo || highlight ? "var(--epi-gold-500)" : "transparent",
                    color: promo || highlight ? "var(--epi-navy-900)" : "var(--epi-cream-50)",
                    border: `1px solid ${promo || highlight ? "transparent" : "rgba(255,255,255,0.18)"}`,
                    fontSize: 14,
                    fontWeight: promo ? 700 : 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "var(--epi-font-body)",
                  }}
                >
                  {plan === currentPlan
                    ? "Current Plan"
                    : promo
                      ? t("redesign.pricingPage.startTrialCta")
                      : currentPlan === "FREE" && plan === "OPERATIONS"
                        ? "Upgrade Plan"
                        : currentPlan && key !== "t4"
                          ? "Switch Plan"
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

          {/* Trial bar */}
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
              onClick={() => {
                if (user) {
                  handleCta("t2", "POS", true);
                } else {
                  trackEvent("cta_click", {
                    event_category: "engagement",
                    event_label: "pricing_trial_bar",
                  });
                  window.location.href = "/register?callbackURL=/pricing?trial=true";
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
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--epi-navy-800, #0f1f38)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "36px 32px",
              maxWidth: 420,
              width: "90%",
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
                Confirm Plan Change
              </div>
              <div
                className="epi-display"
                style={{ fontSize: 28, color: "var(--epi-cream-50)", letterSpacing: "0.04em" }}
              >
                {confirming.trial
                  ? `Start ${confirming.name} free trial`
                  : `Switch to ${confirming.name}`}
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
                {confirming.trial ? (
                  <>
                    You&apos;ll add a card but{" "}
                    <strong style={{ color: "var(--epi-cream-50)", opacity: 1 }}>
                      won&apos;t be charged for 14 days
                    </strong>
                    . After the trial your{" "}
                    <strong style={{ color: "var(--epi-cream-50)", opacity: 1 }}>
                      {confirming.name}
                    </strong>{" "}
                    plan renews automatically — cancel anytime from billing settings before then to
                    avoid charges.
                  </>
                ) : (
                  <>
                    Your subscription will be updated to the{" "}
                    <strong style={{ color: "var(--epi-cream-50)", opacity: 1 }}>
                      {confirming.name}
                    </strong>{" "}
                    plan immediately. You can change this anytime from your billing settings.
                  </>
                )}
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
                Cancel
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
                {isActivating ? "Activating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
