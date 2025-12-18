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
import { SSRPlaceholder } from "@/components/shared";

const OLD_WAY_ITEMS = ["manualSpreadsheets", "foodWaste", "guessingOrders", "unclearCosts"];

const EPIDOM_WAY_ITEMS = ["realtimeTracking", "smartAlerts", "dataDriven", "preciseCosts"];

export function PainGainSection() {
  const { t } = useI18n();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>({
    threshold: INTERSECTION_OPTIONS.thresholdHigh,
  });
  const [activeCard, setActiveCard] = useState<"old" | "new" | null>(null);

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <SSRPlaceholder
        height="500px"
        className="bg-gray-50 py-20 md:py-28"
      />
    );
  }

  return (
    <section ref={ref} className="relative overflow-hidden bg-gray-50 py-20 md:py-28">
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gray-50/50" />
      </div>

      <Container maxWidth="7xl" className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`mb-16 text-center transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        >
          <h2 className="text-brand-primary mb-6 text-4xl font-bold sm:text-5xl md:text-6xl">
            {t("home.painGain.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-3xl text-lg md:text-xl">
            {t("home.painGain.description")}
          </p>
        </div>

        {/* Visual Comparison */}
        <div className="mx-auto flex max-w-5xl flex-col items-stretch gap-8 lg:flex-row">
          {/* Old Way Card */}
          <article
            className={`flex-1 transition-all duration-700 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"}`}
            onMouseEnter={() => setActiveCard("old")}
            onMouseLeave={() => setActiveCard(null)}
          >
            <div
              className={`relative h-full rounded-3xl border-2 bg-white p-8 transition-all duration-500 md:p-10 ${
                activeCard === "old"
                  ? "scale-105 border-red-200 shadow-2xl shadow-red-100/50"
                  : activeCard === "new"
                    ? "scale-95 border-gray-100 opacity-60"
                    : "border-gray-200 shadow-lg"
              }`}
            >
              {/* Header */}
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100"
                    aria-hidden="true"
                  >
                    <X className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-brand-primary text-xl font-bold">
                      {t("home.painGain.oldWay.title")}
                    </h3>
                    <p className="text-sm text-red-500/70">{t("home.painGain.oldWay.subtitle")}</p>
                  </div>
                </div>
                <TrendingDown className="h-8 w-8 text-red-400" aria-hidden="true" />
              </div>

              {/* Items */}
              <ul className="space-y-4" role="list">
                {OLD_WAY_ITEMS.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 rounded-xl border border-red-100/50 bg-red-50/50 p-3"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                      transition: `all 0.5s ease`,
                      transitionDelay: getStaggerDelay(index, 300),
                    }}
                  >
                    <div
                      className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100"
                      aria-hidden="true"
                    >
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <span className="text-brand-primary/70 leading-relaxed">
                      {t(`home.painGain.oldWay.items.${item}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Visual indicator */}
              <div
                className="mt-8 h-1 rounded-full bg-gradient-to-r from-red-300 to-red-100"
                aria-hidden="true"
              />
            </div>
          </article>

          {/* Arrow in middle */}
          <div
            className={`hidden items-center justify-center transition-all delay-500 duration-1000 lg:flex ${isVisible ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
            aria-hidden="true"
          >
            <div className="bg-brand-primary flex h-16 w-16 items-center justify-center rounded-full shadow-xl">
              <ArrowRight className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Mobile Arrow */}
          <div
            className={`flex justify-center transition-all delay-500 duration-1000 lg:hidden ${isVisible ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
          >
            <div className="bg-brand-primary flex h-12 w-12 rotate-90 items-center justify-center rounded-full shadow-lg">
              <ArrowRight className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Epidom Way Card */}
          <article
            className={`flex-1 transition-all delay-200 duration-700 ${isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
            onMouseEnter={() => setActiveCard("new")}
            onMouseLeave={() => setActiveCard(null)}
          >
            <div
              className={`from-brand-primary relative h-full rounded-3xl bg-gradient-to-br to-gray-800 p-8 text-white transition-all duration-500 md:p-10 ${
                activeCard === "new"
                  ? "shadow-brand-primary/30 scale-105 shadow-2xl"
                  : activeCard === "old"
                    ? "scale-95 opacity-60"
                    : "shadow-xl"
              }`}
            >
              {/* Header */}
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm"
                    aria-hidden="true"
                  >
                    <Check className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{t("home.painGain.epidomWay.title")}</h3>
                    <p className="text-sm text-white/60">{t("home.painGain.epidomWay.subtitle")}</p>
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" aria-hidden="true" />
              </div>

              {/* Items */}
              <ul className="space-y-4" role="list">
                {EPIDOM_WAY_ITEMS.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateX(0)" : "translateX(20px)",
                      transition: `all 0.5s ease`,
                      transitionDelay: getStaggerDelay(index, 500),
                    }}
                  >
                    <div
                      className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/80"
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="leading-relaxed font-medium text-white/90">
                      {t(`home.painGain.epidomWay.items.${item}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Visual indicator */}
              <div
                className="mt-8 h-1 rounded-full bg-gradient-to-r from-green-400 to-emerald-300"
                aria-hidden="true"
              />

              {/* Decorative glow */}
              <div
                className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-green-500/20 blur-3xl"
                aria-hidden="true"
              />
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}
