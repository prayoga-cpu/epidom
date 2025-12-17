"use client";

/**
 * Pricing Section - PREMIUM Edition
 *
 * Features:
 * - 3D card effects
 * - Animated highlights
 * - Premium hover interactions
 * - Glassmorphism on popular card
 *
 * @component
 */

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { Check, Sparkles, Star, Crown, ArrowRight, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { getFeatureDelay, getStaggerDelay } from "@/lib/constants/animations";

const PRICING_TIERS = [
  {
    key: "free",
    icon: Sparkles,
    price: "€0",
    period: "",
    popular: false,
    features: ["freeTrial", "limitedTime", "creditCard", "fullAccess"],
  },
  {
    key: "pro",
    icon: Zap,
    price: "€79",
    period: "/mo",
    popular: true,
    features: ["multiStore", "unlimited", "advanced", "priority", "whatsapp"],
  },
  {
    key: "custom",
    icon: Crown,
    price: "Custom",
    period: "",
    popular: false,
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

  // Return placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <section className="relative bg-white py-20 md:py-28 overflow-hidden">
        <div className="h-[600px]" />
      </section>
    );
  }

  return (
    <section ref={ref} className="relative bg-white py-20 md:py-28 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-brand-primary/5 to-transparent rounded-full" />
      </div>

      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className={`text-center mb-20 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 bg-brand-primary/5 rounded-full px-4 py-2 mb-6">
            <Star className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <span className="text-sm font-medium text-brand-primary">
              {t("home.pricing.ribbon")}
            </span>
          </div>

          <h2 className="text-brand-primary text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            {t("home.pricing.headline")}
          </h2>
          <p className="text-brand-primary/60 text-lg md:text-xl max-w-2xl mx-auto">
            {t("home.pricing.subheadline")}
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {PRICING_TIERS.map(({ key, icon: Icon, price, period, popular, features }, index) => (
            <article
              key={key}
              className={`relative transition-all duration-700 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              } ${popular ? "md:-mt-8 md:mb-8" : ""}`}
              style={{ transitionDelay: getStaggerDelay(index, 150) }}
              onMouseEnter={() => setHoveredCard(key)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className={`relative rounded-3xl p-8 transition-all duration-500 ${
                  popular
                    ? "bg-gradient-to-br from-brand-primary to-gray-800 text-white shadow-2xl"
                    : "bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-xl"
                } ${hoveredCard === key ? "scale-105" : ""}`}
              >
                {/* Popular Badge with animation */}
                {popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-400 rounded-full blur-md animate-pulse" aria-hidden="true" />
                      <div className="relative bg-gradient-to-r from-amber-400 to-orange-500 text-brand-primary px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                        <Zap className="w-4 h-4" aria-hidden="true" />
                        {t("home.pricing.mostPopular")}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col h-full">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                    popular
                      ? "bg-white/10 backdrop-blur-sm"
                      : "bg-brand-primary/5"
                  }`}>
                    <Icon className={`w-7 h-7 ${popular ? "text-white" : "text-brand-primary"}`} aria-hidden="true" />
                  </div>

                  {/* Plan Name */}
                  <h3 className={`text-2xl font-bold mb-4 ${popular ? "text-white" : "text-brand-primary"}`}>
                    {t(`home.pricing.${key}.name`)}
                  </h3>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-bold ${popular ? "text-white" : "text-brand-primary"}`}>
                        {price}
                      </span>
                      {period && (
                        <span className={`text-lg ${popular ? "text-white/60" : "text-brand-primary/40"}`}>
                          {period}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8 flex-1" role="list">
                    {features.map((feature, i) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3"
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible ? "translateX(0)" : "translateX(-10px)",
                          transition: `all 0.5s ease`,
                          transitionDelay: getFeatureDelay(index, i),
                        }}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          popular ? "bg-white/20" : "bg-brand-primary/10"
                        }`} aria-hidden="true">
                          <Check className={`w-3 h-3 ${popular ? "text-white" : "text-brand-primary"}`} />
                        </div>
                        <span className={`text-sm ${popular ? "text-white/90" : "text-brand-primary/70"}`}>
                          {t(`home.pricing.${key}.features.${feature}`)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleSelectPlan(key)}
                    className={`w-full py-6 rounded-2xl font-semibold transition-all duration-300 group ${
                      popular
                        ? "bg-white text-brand-primary hover:bg-gray-100 shadow-lg hover:shadow-xl"
                        : "bg-brand-primary text-white hover:bg-brand-primary/90"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {key === "custom" ? t("home.pricing.custom.cta") : t("home.pricing.cta")}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </span>
                  </Button>
                </div>

                {/* Shine effect on hover */}
                {popular && (
                  <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none" aria-hidden="true">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Bottom Note */}
        <div className={`mt-16 text-center transition-all duration-1000 delay-500 ${isVisible ? "opacity-100" : "opacity-0"}`}>
          <p className="text-brand-primary/40 text-sm">
            {t("home.pricing.note")}
          </p>
        </div>
      </Container>
    </section>
  );
}
