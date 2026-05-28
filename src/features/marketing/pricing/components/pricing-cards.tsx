"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

const TIERS = [
  { idx: 0, key: "t1", highlight: false, plan: "FREE" },
  { idx: 1, key: "t2", highlight: false, plan: "POS" },
  { idx: 2, key: "t3", highlight: true, plan: "OPERATIONS" },
  { idx: 3, key: "t4", highlight: false, plan: "ENTERPRISE" },
] as const;

const FEAT_COUNTS = [6, 6, 8, 8] as const;

const FREE_PRICES = new Set(["$0", "0 €", "Rp 0", "€0"]);
const CUSTOM_PRICES = new Set(["Custom", "Sur devis", "Kustom"]);

export function PricingCards({ yearly }: { yearly: boolean }) {
  const { t } = useI18n();

  const [confirming, setConfirming] = useState<{ key: string; plan: string; name: string } | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  function getPrice(tierKey: string) {
    const mo = t(`redesign.pricingPage.${tierKey}price_mo` as const);
    const yr = t(`redesign.pricingPage.${tierKey}price_yr` as const);
    return yearly ? yr : mo;
  }

  function isFree(price: string) { return FREE_PRICES.has(price); }
  function isCustom(price: string) { return CUSTOM_PRICES.has(price); }

  function getBilling(tierKey: string) {
    const price = getPrice(tierKey);
    if (isFree(price)) return t("redesign.pricingPage.freeForever");
    if (isCustom(price)) return t("redesign.pricingPage.talkSales");
    return yearly ? t("redesign.pricingPage.billedYearly") : t("redesign.pricingPage.billedMonthly");
  }

  function handleCta(tierKey: string, plan: string) {
    if (tierKey === "t4") {
      window.open("https://calendly.com/prayogadevelopment/30min", "_blank");
      return;
    }
    const name = t(`redesign.pricingPage.${tierKey}name` as const);
    setConfirming({ key: tierKey, plan, name });
  }

  async function confirmActivate() {
    if (!confirming) return;
    setIsActivating(true);
    try {
      const res = await fetch("/api/subscriptions/activate-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: confirming.plan }),
      });
      if (res.status === 401) {
        window.location.href = "/register";
      } else if (res.ok) {
        // Full navigation to flush React Query cache so new plan reflects immediately
        window.location.href = "/stores";
      } else {
        window.location.href = "/register";
      }
    } catch {
      window.location.href = "/register";
    } finally {
      setIsActivating(false);
      setConfirming(null);
    }
  }

  return (
    <>
      <section style={{ padding: "40px 0 80px" }}>
        <div className="epi-container">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            style={{ gap: 14 }}
          >
            {TIERS.map(({ idx, key, highlight, plan }) => (
              <div
                key={key}
                style={{
                  position: "relative",
                  padding: 30,
                  borderRadius: 24,
                  background: highlight
                    ? "linear-gradient(160deg, rgba(217,174,59,0.18), rgba(217,174,59,0.04))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid",
                  borderColor: highlight ? "rgba(217,174,59,0.45)" : "rgba(255,255,255,0.08)",
                  display: "flex", flexDirection: "column", gap: 20,
                }}
              >
                {highlight && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", padding: "6px 14px", borderRadius: 999, background: "var(--epi-gold-500)", color: "var(--epi-navy-900)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {t("redesign.pricingPage.mostPopular")}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--epi-cream-50)", opacity: 0.4, marginBottom: 10 }}>
                    {t(`redesign.pricingPage.${key}tag` as const)}
                  </div>
                  <div className="epi-display" style={{ fontSize: 36, letterSpacing: "0.04em", color: "var(--epi-cream-50)", lineHeight: 1 }}>
                    {t(`redesign.pricingPage.${key}name` as const)}
                  </div>
                  <div style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                    {t(`redesign.pricingPage.${key}tagline` as const)}
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="epi-display" style={{ fontSize: isCustom(getPrice(key)) ? 32 : 56, color: "var(--epi-cream-50)", letterSpacing: "0.01em", lineHeight: 1 }}>
                      {getPrice(key)}
                    </span>
                    {!isCustom(getPrice(key)) && !isFree(getPrice(key)) && (
                      <span style={{ color: "var(--epi-cream-50)", opacity: 0.5, fontSize: 13 }}>/mo</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--epi-cream-50)", opacity: 0.4, marginTop: 4 }}>{getBilling(key)}</div>
                </div>

                <button
                  onClick={() => handleCta(key, plan)}
                  disabled={isActivating}
                  className="cursor-pointer transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ width: "100%", padding: "14px 0", borderRadius: 999, background: highlight ? "var(--epi-gold-500)" : "transparent", color: highlight ? "var(--epi-navy-900)" : "var(--epi-cream-50)", border: `1px solid ${highlight ? "transparent" : "rgba(255,255,255,0.18)"}`, fontSize: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--epi-font-body)" }}
                >
                  {t(`redesign.pricingPage.${key}cta` as const)}
                </button>

                <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: FEAT_COUNTS[idx] }, (_, n) => {
                    const featKey = `redesign.pricingPage.${key}f${n + 1}` as Parameters<typeof t>[0];
                    const text = t(featKey);
                    const included = !text.startsWith("redesign.");
                    return (
                      <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, color: included ? "var(--epi-cream-50)" : "rgba(251,249,228,0.25)", fontSize: 13 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                          {included ? (
                            <>
                              <circle cx="8" cy="8" r="7" fill="rgba(217,174,59,0.16)" />
                              <path d="M5 8l2 2 4-4" stroke="var(--epi-gold-400)" strokeWidth="1.6" fill="none" />
                            </>
                          ) : (
                            <circle cx="8" cy="8" r="7" fill="none" stroke="rgba(255,255,255,0.08)" />
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
          <div style={{ marginTop: 32, padding: "20px 28px", borderRadius: 16, background: "rgba(91,136,178,0.10)", border: "1px solid rgba(91,136,178,0.30)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="epi-display" style={{ fontSize: 22, letterSpacing: "0.04em", color: "var(--epi-cream-50)" }}>{t("redesign.pricingPage.trialBar")}</div>
              <div style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 14, marginTop: 4 }}>{t("redesign.pricingPage.trialBarSub")}</div>
            </div>
            <button
              onClick={() => { window.location.href = "/register"; }}
              className="cursor-pointer transition-all hover:-translate-y-px"
              style={{ padding: "12px 28px", borderRadius: 999, background: "var(--epi-cream-50)", color: "var(--epi-navy-900)", fontSize: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", fontFamily: "var(--epi-font-body)", whiteSpace: "nowrap" }}
            >
              {t("redesign.pricingPage.trialBarCta")}
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation dialog */}
      {confirming && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => !isActivating && setConfirming(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--epi-navy-800, #0f1f38)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "36px 32px", maxWidth: 420, width: "90%", display: "flex", flexDirection: "column", gap: 20 }}
          >
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--epi-cream-50)", opacity: 0.4, marginBottom: 8 }}>
                Confirm Plan Change
              </div>
              <div className="epi-display" style={{ fontSize: 28, color: "var(--epi-cream-50)", letterSpacing: "0.04em" }}>
                Switch to {confirming.name}
              </div>
              <p style={{ color: "var(--epi-cream-50)", opacity: 0.6, fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>
                Your subscription will be updated to the <strong style={{ color: "var(--epi-cream-50)", opacity: 1 }}>{confirming.name}</strong> plan immediately. You can change this anytime from your billing settings.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirming(null)}
                disabled={isActivating}
                style={{ flex: 1, padding: "13px 0", borderRadius: 999, background: "transparent", color: "var(--epi-cream-50)", border: "1px solid rgba(255,255,255,0.18)", fontSize: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--epi-font-body)", cursor: "pointer", opacity: isActivating ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmActivate}
                disabled={isActivating}
                style={{ flex: 1, padding: "13px 0", borderRadius: 999, background: "var(--epi-gold-500)", color: "var(--epi-navy-900)", border: "none", fontSize: 14, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--epi-font-body)", cursor: isActivating ? "not-allowed" : "pointer", opacity: isActivating ? 0.6 : 1 }}
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
