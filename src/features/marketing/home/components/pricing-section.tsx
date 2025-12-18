"use client";

/**
 * Pricing Section - With Promo Banner
 *
 * Shows all pricing tiers, but ends with a prominent
 * promotional banner highlighting the FREE offer.
 *
 * @component
 */

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { Check, Sparkles, Crown, ArrowRight, Zap, Gift, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { getFeatureDelay, getStaggerDelay } from "@/lib/constants/animations";

const PRICING_TIERS = [
  {
    key: "pro",
    icon: Zap,
    price: "€79",
    period: "/mo",
    features: ["multiStore", "unlimited", "advanced", "priority", "whatsapp"],
  },
  {
    key: "custom",
    icon: Crown,
    price: "Custom",
    period: "",
    features: ["franchise", "dedicated", "custom", "onboarding"],
  },
];

export function PricingSection() {
  const { t } = useI18n();
  const router = useRouter();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleSelectPlan = (planKey: string) => {
    if (planKey === "custom") {
      router.push("/contact");
    } else {
      router.push("/register");
    }
  };

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <section className="relative overflow-hidden bg-white py-20 md:py-28">
        <div className="h-[800px]" />
      </section>
    );
  }

  return (
    <section ref={ref} className="relative overflow-hidden bg-white py-20 md:py-28">
      <Container maxWidth="6xl" className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div
          className={`mb-16 text-center transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <h2 className="text-brand-primary mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
            {t("home.pricing.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-2xl text-lg">
            {t("home.pricing.subheadline")}
          </p>
        </div>

        {/* Pricing Cards - Pro and Custom only */}
        <div className="mx-auto mb-16 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {PRICING_TIERS.map(({ key, icon: Icon, price, period, features }, index) => (
            <article
              key={key}
              className={`relative transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: getStaggerDelay(index, 150) }}
              onMouseEnter={() => setHoveredCard(key)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className={`relative h-full rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 ${
                  hoveredCard === key ? "shadow-xl" : "shadow-sm"
                }`}
              >
                <div className="flex h-full flex-col">
                  {/* Icon & Name */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="bg-brand-primary/5 flex h-10 w-10 items-center justify-center rounded-xl">
                      <Icon className="text-brand-primary h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-brand-primary text-lg font-bold">
                      {t(`home.pricing.${key}.name`)}
                    </h3>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-brand-primary text-3xl font-bold">{price}</span>
                    {period && <span className="text-brand-primary/40 text-sm">{period}</span>}
                  </div>

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-2" role="list">
                    {features.map((feature, i) => (
                      <li
                        key={feature}
                        className="text-brand-primary/70 flex items-start gap-2 text-sm"
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transition: `opacity 0.5s ease`,
                          transitionDelay: getFeatureDelay(index, i),
                        }}
                      >
                        <Check className="text-brand-primary/40 mt-0.5 h-4 w-4 flex-shrink-0" />
                        {t(`home.pricing.${key}.features.${feature}`)}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    onClick={() => handleSelectPlan(key)}
                    variant="outline"
                    className="border-brand-primary/20 text-brand-primary hover:bg-brand-primary w-full rounded-xl hover:text-white"
                  >
                    {key === "custom" ? t("home.pricing.custom.cta") : t("home.pricing.cta")}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ========================================
            PROMO BANNER - The Main Highlight!
            ======================================== */}
        <div
          className={`from-brand-primary to-brand-primary relative overflow-hidden rounded-3xl bg-gradient-to-r via-gray-800 p-8 shadow-2xl transition-all delay-300 duration-1000 md:p-12 ${
            isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-95 opacity-0"
          }`}
        >
          {/* Background glow */}
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
            {/* Left: Promo Message */}
            <div className="flex-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <Clock className="h-4 w-4 text-white" />
                <span className="text-xs font-semibold tracking-wider text-white uppercase">
                  {t("home.pricing.free.features.limitedTime")}
                </span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-white md:text-3xl lg:text-4xl">
                🎉 {t("home.pricing.free.name")}
              </h3>
              <p className="text-white/70">
                {t("home.pricing.free.features.fullAccess")} •{" "}
                {t("home.pricing.free.features.creditCard")}
              </p>
            </div>

            {/* Center: Price */}
            <div className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-white/80" />
              <span className="text-5xl font-black text-white md:text-6xl lg:text-7xl">€0</span>
            </div>

            {/* Right: CTA */}
            <div className="flex-shrink-0">
              <Button
                onClick={() => router.push("/register")}
                size="lg"
                className="group text-brand-primary cursor-pointer rounded-full bg-white px-8 py-6 text-base font-bold shadow-xl transition-all duration-300 hover:scale-105 hover:bg-gray-100"
              >
                <Gift className="mr-2 h-5 w-5" />
                {t("home.pricing.cta")}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Note */}
        <p className="text-brand-primary/40 mt-8 text-center text-sm">{t("home.pricing.note")}</p>
      </Container>
    </section>
  );
}
