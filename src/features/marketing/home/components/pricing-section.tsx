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
import { Check, Crown, Zap, Store, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { getFeatureDelay, getStaggerDelay } from "@/lib/constants/animations";
import { SSRPlaceholder } from "@/components/shared";

const PRICING_TIERS = [
  {
    key: "free",
    icon: Play,
    price: "Rp 0",
    period: "/bln",
    features: ["f1", "f2", "f3"],
  },
  {
    key: "pos",
    icon: Store,
    price: "Rp 99.000",
    period: "/bln",
    features: ["f1", "f2", "f3"],
  },
  {
    key: "operations",
    icon: Zap,
    price: "Rp 249.000",
    period: "/bln",
    features: ["f1", "f2", "f3", "f4"],
    highlight: true,
  },
  {
    key: "enterprise",
    icon: Crown,
    price: "Custom",
    period: "",
    features: ["f1", "f2", "f3"],
  },
];

export function PricingSection() {
  const { t } = useI18n();
  const router = useRouter();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleSelectPlan = (planKey: string) => {
    if (planKey === "enterprise") {
      window.open("https://calendly.com/prayogadevelopment/30min", "_blank");
    } else {
      router.push("/register");
    }
  };

  // Return placeholder during SSR
  if (!mounted) {
    return <SSRPlaceholder height="800px" className="bg-white py-20 md:py-28" />;
  }

  return (
    <section ref={ref} className="relative overflow-hidden bg-white py-20 md:py-28">
      <Container maxWidth="7xl" className="relative z-10 px-4 sm:px-6 lg:px-8">
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

        {/* Pricing Cards */}
        <div className="mx-auto mb-16 grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_TIERS.map(({ key, icon: Icon, price, period, features, highlight }, index) => (
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
                className={`relative h-full flex flex-col rounded-2xl border ${
                  highlight ? "border-brand-primary border-2 shadow-xl" : "border-gray-200"
                } bg-white p-6 transition-all duration-300 ${
                  hoveredCard === key && !highlight ? "shadow-xl" : highlight ? "" : "shadow-sm"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-brand-primary rounded-full px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
                      {t("home.pricing.mostPopular")}
                    </span>
                  </div>
                )}
                
                <div className="flex h-full flex-col">
                  {/* Icon & Name */}
                  <div className="mb-4 flex items-center gap-3 mt-2">
                    <div className="bg-brand-primary/5 flex h-10 w-10 items-center justify-center rounded-xl">
                      <Icon className="text-brand-primary h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-brand-primary text-lg font-bold">
                      {t(`home.pricing.${key}.name`)}
                    </h3>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-brand-primary text-3xl font-bold">{price}</span>
                    {period && <span className="text-brand-primary/40 text-sm">{period}</span>}
                  </div>

                  {/* Features */}
                  <ul className="mb-8 flex-1 space-y-3" role="list">
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
                    className={`w-full cursor-pointer rounded-xl border-2 font-bold transition-all duration-300 ${
                      highlight 
                        ? "bg-brand-primary border-brand-primary text-white hover:bg-brand-primary/90 hover:shadow-lg" 
                        : "bg-transparent border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white hover:shadow-lg"
                    }`}
                  >
                    {key === "enterprise" ? t("home.pricing.enterprise.cta") : t("home.pricing.cta")}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="text-brand-primary/40 mt-8 text-center text-sm">{t("home.pricing.note")}</p>
      </Container>
    </section>
  );
}
