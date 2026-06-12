"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { PricingCards } from "./pricing-cards";
import { FeatureComparison } from "./feature-comparison";
import { PricingFaq } from "./pricing-faq";
import { PricingCta } from "./pricing-cta";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";

export function PricingPageClient() {
  const { t } = useI18n();
  const [yearly, setYearly] = useState(true);
  const { data: subData } = useSubscriptionStatus();
  const currentPlan = subData?.hasSubscription ? subData.subscription?.plan : null;

  return (
    <>
      {/* Hero */}
      <section style={{ paddingTop: 140, paddingBottom: 60, position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(217,174,59,0.20), transparent 60%)", pointerEvents: "none" }} />
        <div className="epi-container" style={{ position: "relative" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("redesign.pricingPage.eyebrow")}</div>
          <h1
            className="epi-display"
            style={{ fontSize: "clamp(48px, 8vw, 128px)", margin: 0, lineHeight: 0.95, paddingBottom: 12, color: "var(--epi-cream-50)" }}
          >
            {t("redesign.pricingPage.title1")}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>{t("redesign.pricingPage.titleAccent")}</span>,<br />
            {t("redesign.pricingPage.title2")}
          </h1>
          <p className="epi-script" style={{ fontSize: "clamp(20px, 2.4vw, 26px)", color: "var(--epi-cream-100)", marginTop: 18, maxWidth: 640, marginInline: "auto", display: "block" }}>
            {t("redesign.pricingPage.script")}
          </p>
          <div style={{ display: "inline-flex", marginTop: 40, padding: 4, borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <button onClick={() => setYearly(false)} className="cursor-pointer transition-all" style={{ padding: "10px 22px", borderRadius: 999, background: !yearly ? "var(--epi-cream-50)" : "transparent", color: !yearly ? "var(--epi-navy-900)" : "rgba(251,249,228,0.5)", border: "none", fontSize: 13, letterSpacing: "0.06em", fontFamily: "var(--epi-font-body)", textTransform: "uppercase", fontWeight: 500 }}>
              {t("redesign.pricingPage.toggleMonthly")}
            </button>
            <button onClick={() => setYearly(true)} className="cursor-pointer transition-all" style={{ padding: "10px 22px", borderRadius: 999, background: yearly ? "var(--epi-cream-50)" : "transparent", color: yearly ? "var(--epi-navy-900)" : "rgba(251,249,228,0.5)", border: "none", fontSize: 13, letterSpacing: "0.06em", fontFamily: "var(--epi-font-body)", textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap" }}>
              {t("redesign.pricingPage.toggleYearly")}
            </button>
          </div>
        </div>
      </section>

      <PricingCards yearly={yearly} currentPlan={currentPlan} />
      <FeatureComparison />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
