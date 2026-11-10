"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { PlanBillingToggle } from "@/components/shared/plan-billing-toggle";
import { usePriceCurrency } from "@/lib/hooks/use-price-currency";
import { PricingCards } from "./pricing-cards";
import { PricingClaudeStrip } from "./pricing-claude-strip";
import { FeatureComparison } from "./feature-comparison";
import { PricingFaq } from "./pricing-faq";
import { PricingCta } from "./pricing-cta";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";

export function PricingPageClient() {
  const { t, locale } = useI18n();
  const [yearly, setYearly] = useState(true);
  // Quoted in the language's currency first, then the visitor's own (detected, or what they chose before).
  const [currency, setCurrency] = usePriceCurrency(locale);
  const { data: subData } = useSubscriptionStatus();
  const currentPlan = subData?.hasSubscription ? subData.subscription?.plan : null;

  return (
    <>
      {/* Hero */}
      <section
        style={{
          paddingTop: 140,
          paddingBottom: 60,
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(217,174,59,0.20), transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div className="epi-container" style={{ position: "relative" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("redesign.pricingPage.eyebrow")}
          </div>
          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(48px, 8vw, 128px)",
              margin: 0,
              lineHeight: 0.95,
              paddingBottom: 12,
              color: "var(--epi-cream-50)",
            }}
          >
            {t("redesign.pricingPage.title1")}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>
              {t("redesign.pricingPage.titleAccent")}
            </span>
            ,<br />
            {t("redesign.pricingPage.title2")}
          </h1>
          <p
            className="epi-script"
            style={{
              fontSize: "clamp(20px, 2.4vw, 26px)",
              color: "var(--epi-cream-100)",
              marginTop: 18,
              maxWidth: 640,
              marginInline: "auto",
              display: "block",
            }}
          >
            {t("redesign.pricingPage.script")}
          </p>
          <div style={{ marginTop: 40 }}>
            <PlanBillingToggle
              tone="dark"
              yearly={yearly}
              onYearlyChange={setYearly}
              currency={currency}
              onCurrencyChange={setCurrency}
              monthlyLabel={t("redesign.pricingPage.toggleMonthly")}
              yearlyLabel={t("redesign.pricingPage.toggleYearly")}
              groupLabel={t("redesign.pricingPage.toggleMonthly")}
              currencyLabel={t("onboarding.flow.plan.currency")}
            />
          </div>
        </div>
      </section>

      <PricingClaudeStrip />
      <PricingCards
        yearly={yearly}
        currency={currency}
        currentPlan={currentPlan}
        onYearlyChange={setYearly}
      />
      <FeatureComparison />
      <PricingFaq />
      <PricingCta />
    </>
  );
}
