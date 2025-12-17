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
      <section className="relative bg-brand-primary py-24 md:py-32 overflow-hidden">
        <div className="h-[500px]" />
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="relative bg-brand-primary py-24 md:py-32 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Animated Background */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Gradient orbs that follow mouse slightly */}
        <div
          className="absolute w-[600px] h-[600px] bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl transition-transform duration-1000 ease-out"
          style={{
            left: `${20 + mousePosition.x * 10}%`,
            top: `${20 + mousePosition.y * 10}%`,
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl transition-transform duration-1000 ease-out"
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
              className="absolute w-1 h-1 bg-white/20 rounded-full animate-float-particle"
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
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02]" />
      </div>

      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">

          {/* Sparkle badge */}
          <div className={`inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span className="text-sm font-medium text-white/80">
              {t("home.closingCta.badge")}
            </span>
          </div>

          {/* Headline */}
          <h2 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight transition-all duration-1000 delay-100 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {t("home.closingCta.headline")}
          </h2>

          {/* Description */}
          <p className={`text-xl md:text-2xl text-white/70 mb-12 leading-relaxed max-w-2xl mx-auto transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {t("home.closingCta.description")}
          </p>

          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-16 transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <Button
              onClick={handleStartFree}
              size="lg"
              className="group relative bg-white text-brand-primary hover:bg-gray-100 cursor-pointer rounded-full px-10 py-7 text-lg font-bold transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                {t("home.closingCta.ctaStartFree")}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </span>
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-primary/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" aria-hidden="true" />
            </Button>

            <Button
              onClick={handleDemo}
              variant="outline"
              size="lg"
              className="group border-white/30 text-white hover:bg-white/10 cursor-pointer rounded-full border-2 px-10 py-7 text-lg font-bold transition-all duration-300 hover:border-white/50"
            >
              <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
              {t("home.closingCta.ctaDemo")}
            </Button>
          </div>

          {/* Trust Badges */}
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {TRUST_BADGES.map(({ key, icon: Icon }, index) => (
              <div
                key={key}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-default"
                style={{ transitionDelay: getStaggerDelay(index, 400) }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-white/80" aria-hidden="true" />
                </div>
                <span className="text-white/80 font-medium text-sm">
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
