"use client";

/**
 * Pain+Gain Comparison Section - PREMIUM Edition
 *
 * Features:
 * - Animated comparison with visual contrast
 * - Interactive hover effects
 * - Premium card styling
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { X, Check, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { INTERSECTION_OPTIONS, getStaggerDelay } from "@/lib/constants/animations";

const OLD_WAY_ITEMS = [
  "manualSpreadsheets",
  "foodWaste",
  "guessingOrders",
  "unclearCosts",
];

const EPIDOM_WAY_ITEMS = [
  "realtimeTracking",
  "smartAlerts",
  "dataDriven",
  "preciseCosts",
];

export function PainGainSection() {
  const { t } = useI18n();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>({
    threshold: INTERSECTION_OPTIONS.thresholdHigh,
  });
  const [activeCard, setActiveCard] = useState<"old" | "new" | null>(null);

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <section className="relative bg-gray-50 py-20 md:py-28 overflow-hidden">
        <div className="h-[500px]" />
      </section>
    );
  }

  return (
    <section ref={ref} className="relative bg-gray-50 py-20 md:py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-r from-red-50/50 via-transparent to-green-50/50" />
      </div>

      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-brand-primary text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            {t("home.painGain.headline")}
          </h2>
          <p className="text-brand-primary/60 text-lg md:text-xl max-w-3xl mx-auto">
            {t("home.painGain.description")}
          </p>
        </div>

        {/* Visual Comparison */}
        <div className="flex flex-col lg:flex-row items-stretch gap-8 max-w-5xl mx-auto">

          {/* Old Way Card */}
          <article
            className={`flex-1 transition-all duration-700 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
            onMouseEnter={() => setActiveCard("old")}
            onMouseLeave={() => setActiveCard(null)}
          >
            <div className={`relative h-full bg-white rounded-3xl p-8 md:p-10 border-2 transition-all duration-500 ${
              activeCard === "old"
                ? "border-red-200 shadow-2xl shadow-red-100/50 scale-105"
                : activeCard === "new"
                ? "border-gray-100 opacity-60 scale-95"
                : "border-gray-200 shadow-lg"
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center" aria-hidden="true">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-brand-primary">
                      {t("home.painGain.oldWay.title")}
                    </h3>
                    <p className="text-sm text-red-500/70">{t("home.painGain.oldWay.subtitle")}</p>
                  </div>
                </div>
                <TrendingDown className="w-8 h-8 text-red-400" aria-hidden="true" />
              </div>

              {/* Items */}
              <ul className="space-y-4" role="list">
                {OLD_WAY_ITEMS.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 p-3 rounded-xl bg-red-50/50 border border-red-100/50"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                      transition: `all 0.5s ease`,
                      transitionDelay: getStaggerDelay(index, 300),
                    }}
                  >
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5" aria-hidden="true">
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <span className="text-brand-primary/70 leading-relaxed">
                      {t(`home.painGain.oldWay.items.${item}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Visual indicator */}
              <div className="mt-8 h-1 bg-gradient-to-r from-red-300 to-red-100 rounded-full" aria-hidden="true" />
            </div>
          </article>

          {/* Arrow in middle */}
          <div className={`hidden lg:flex items-center justify-center transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"}`} aria-hidden="true">
            <div className="w-16 h-16 rounded-full bg-brand-primary shadow-xl flex items-center justify-center">
              <ArrowRight className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Mobile Arrow */}
          <div className={`lg:hidden flex justify-center transition-all duration-1000 delay-500 ${isVisible ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            <div className="w-12 h-12 rounded-full bg-brand-primary shadow-lg flex items-center justify-center rotate-90">
              <ArrowRight className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Epidom Way Card */}
          <article
            className={`flex-1 transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
            onMouseEnter={() => setActiveCard("new")}
            onMouseLeave={() => setActiveCard(null)}
          >
            <div className={`relative h-full bg-gradient-to-br from-brand-primary to-gray-800 rounded-3xl p-8 md:p-10 text-white transition-all duration-500 ${
              activeCard === "new"
                ? "shadow-2xl shadow-brand-primary/30 scale-105"
                : activeCard === "old"
                ? "opacity-60 scale-95"
                : "shadow-xl"
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center" aria-hidden="true">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {t("home.painGain.epidomWay.title")}
                    </h3>
                    <p className="text-sm text-white/60">{t("home.painGain.epidomWay.subtitle")}</p>
                  </div>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" aria-hidden="true" />
              </div>

              {/* Items */}
              <ul className="space-y-4" role="list">
                {EPIDOM_WAY_ITEMS.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateX(0)" : "translateX(20px)",
                      transition: `all 0.5s ease`,
                      transitionDelay: getStaggerDelay(index, 500),
                    }}
                  >
                    <div className="w-6 h-6 rounded-full bg-green-500/80 flex items-center justify-center flex-shrink-0 mt-0.5" aria-hidden="true">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-white/90 leading-relaxed font-medium">
                      {t(`home.painGain.epidomWay.items.${item}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Visual indicator */}
              <div className="mt-8 h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full" aria-hidden="true" />

              {/* Decorative glow */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-green-500/20 rounded-full blur-3xl" aria-hidden="true" />
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}
