"use client";

/**
 * Closing CTA Section - PREMIUM Edition
 *
 * Features:
 * - Premium animated background
 * - Floating particles effect
 * - Interactive trust badges
 * - Compelling final call-to-action
 *
 * @component
 */

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { ArrowRight, Calendar, Shield, CreditCard, Clock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import { INTERSECTION_OPTIONS, getStaggerDelay } from "@/lib/constants/animations";

const TRUST_BADGES = [
  { key: "secure", icon: Shield },
  { key: "cancel", icon: CreditCard },
  { key: "quick", icon: Clock },
];

export function ClosingCtaSection() {
  const { t } = useI18n();
  const router = useRouter();
  const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>({
    threshold: INTERSECTION_OPTIONS.thresholdHigh,
  });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const currentRef = ref.current;
    if (!currentRef) return;
    const rect = currentRef.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const handleStartFree = () => {
    router.push("/register");
  };

  const handleDemo = () => {
    router.push("/contact");
  };

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <section className="bg-brand-primary relative overflow-hidden py-24 md:py-32">
        <div className="h-[500px]" />
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="bg-brand-primary relative overflow-hidden py-24 md:py-32"
      onMouseMove={handleMouseMove}
    >
      {/* Animated Background */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Gradient orbs that follow mouse slightly */}
        <div
          className="absolute h-[600px] w-[600px] rounded-full bg-gradient-to-br from-white/10 to-transparent blur-3xl transition-transform duration-1000 ease-out"
          style={{
            left: `${20 + mousePosition.x * 10}%`,
            top: `${20 + mousePosition.y * 10}%`,
          }}
        />
        <div
          className="absolute h-[400px] w-[400px] rounded-full bg-gradient-to-br from-gray-500/20 to-transparent blur-3xl transition-transform duration-1000 ease-out"
          style={{
            right: `${20 + (1 - mousePosition.x) * 10}%`,
            bottom: `${20 + (1 - mousePosition.y) * 10}%`,
          }}
        />

        {/* Floating particles - using globals.css animation */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="animate-float-particle absolute h-1 w-1 rounded-full bg-white/20"
              style={{
                left: `${(i * 5) % 100}%`,
                top: `${(i * 7) % 100}%`,
                animationDelay: `${(i * 0.5) % 5}s`,
                animationDuration: `${5 + (i % 10)}s`,
              }}
            />
          ))}
        </div>

        {/* Grid pattern */}
      </div>

      <Container maxWidth="7xl" className="relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Sparkle badge */}
          <div
            className={`mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
          >
            <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
            <span className="text-sm font-medium text-white/80">{t("home.closingCta.badge")}</span>
          </div>

          {/* Headline */}
          <h2
            className={`mb-8 text-4xl leading-tight font-bold text-white transition-all delay-100 duration-1000 sm:text-5xl md:text-6xl lg:text-7xl ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          >
            {t("home.closingCta.headline")}
          </h2>

          {/* Description */}
          <p
            className={`mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-white/70 transition-all delay-200 duration-1000 md:text-2xl ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          >
            {t("home.closingCta.description")}
          </p>

          {/* CTA Buttons */}
          <div
            className={`mb-16 flex flex-col justify-center gap-4 transition-all delay-300 duration-1000 sm:flex-row ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          >
            <Button
              onClick={handleStartFree}
              size="lg"
              className="group text-brand-primary relative cursor-pointer overflow-hidden rounded-full bg-white px-10 py-7 text-lg font-bold transition-all duration-300 hover:scale-105 hover:bg-gray-100 hover:shadow-2xl"
            >
              <span className="relative z-10 flex items-center">
                {t("home.closingCta.ctaStartFree")}
                <ArrowRight
                  className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
              {/* Shine effect */}
              <div
                className="via-brand-primary/10 absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full"
                aria-hidden="true"
              />
            </Button>

            <Button
              onClick={handleDemo}
              variant="outline"
              size="lg"
              className="group cursor-pointer rounded-full border-2 border-white/30 bg-transparent px-10 py-7 text-lg font-bold text-white transition-all duration-300 hover:border-white/50 hover:bg-white/10 hover:text-white"
            >
              <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
              {t("home.closingCta.ctaDemo")}
            </Button>
          </div>

          {/* Trust Badges */}
          {/* Trust Badges - Minimalist Version */}
          <div
            className={`mx-auto flex max-w-3xl flex-wrap justify-center gap-x-8 gap-y-4 transition-all delay-400 duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          >
            {TRUST_BADGES.map(({ key, icon: Icon }, index) => (
              <div
                key={key}
                className="flex cursor-default items-center gap-2 opacity-60 transition-opacity duration-300 hover:opacity-100"
                style={{ transitionDelay: getStaggerDelay(index, 400) }}
              >
                <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                <span className="text-sm font-medium text-white">
                  {t(`home.closingCta.badges.${key}.title`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
