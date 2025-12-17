"use client";

/**
 * Hero Section Component - PREMIUM Edition
 *
 * Features:
 * - Smooth entrance animations
 * - Floating decorative elements
 * - Glassmorphism effects
 * - Interactive hover states
 * - Mobile device mockup alongside desktop
 *
 * @component
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function HeroSection() {
  const router = useRouter();
  const { t } = useI18n();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStartFree = () => {
    router.push("/register");
  };

  const handleDemo = () => {
    router.push("/contact");
  };

  // Return placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <section className="relative flex min-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-white">
        <div className="flex flex-1 items-center justify-center">
          <div className="h-96 w-full max-w-7xl" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-white">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />

        {/* Floating gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-amber-200/30 to-orange-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-gray-100/50 to-transparent rounded-full" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 w-full items-center justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <Container maxWidth="7xl" className="w-full">
          <div className="grid w-full grid-cols-1 content-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Left Column: Text Content */}
            <div
              className={`z-10 flex flex-col justify-center text-center lg:text-left transition-all duration-1000 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <div className="space-y-6 lg:space-y-8">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-brand-primary/5 backdrop-blur-sm border border-brand-primary/10 rounded-full px-4 py-2 text-sm font-medium text-brand-primary mx-auto lg:mx-0 w-fit">
                  <Sparkles className="w-4 h-4" />
                  <span>{t("home.hero.badge")}</span>
                </div>

                {/* Headline with gradient - using globals.css animation */}
                <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl md:text-5xl lg:text-[3.25rem] xl:text-[4rem]">
                  <span className="text-brand-primary">
                    {t("home.hero.headlinePart1")}
                  </span>{" "}
                  <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 bg-clip-text text-transparent animate-gradient-text">
                    {t("home.hero.headlineHighlight")}
                  </span>{" "}
                  <span className="text-brand-primary">
                    {t("home.hero.headlinePart2")}
                  </span>
                </h1>

                {/* Description */}
                <p className="text-brand-primary/70 mx-auto max-w-xl text-lg leading-relaxed sm:text-xl lg:mx-0 lg:text-lg xl:text-xl">
                  {t("home.hero.description")}
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row lg:justify-start">
                  <Button
                    onClick={handleStartFree}
                    className="group relative bg-brand-primary hover:bg-brand-primary/90 cursor-pointer rounded-full px-8 py-6 text-base font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center">
                      {t("home.hero.ctaStartFree")}
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </Button>

                  <Button
                    onClick={handleDemo}
                    variant="outline"
                    className="group border-brand-primary/30 text-brand-primary hover:bg-brand-primary hover:text-white cursor-pointer rounded-full border-2 px-8 py-6 text-base font-semibold transition-all duration-300 hover:border-brand-primary"
                  >
                    <Calendar className="mr-2 h-5 w-5" />
                    {t("home.hero.ctaDemo")}
                  </Button>
                </div>

                {/* Social proof mini */}
                <div className="flex items-center justify-center lg:justify-start gap-3 pt-4">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 border-2 border-white shadow-sm"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-brand-primary/60">
                    {t("home.hero.socialProofMini")}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Dashboard Mockup with Devices */}
            <div
              className={`relative flex h-full w-full flex-col justify-center transition-all duration-1000 delay-300 ${
                mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
              }`}
            >
              {/* Desktop Browser Window */}
              <div className="relative w-full">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-2xl lg:aspect-[16/10] lg:rounded-2xl">
                  {/* Browser Header - Glassmorphism */}
                  <div className="flex h-8 shrink-0 items-center gap-2 border-b border-gray-200/50 bg-gray-50/80 backdrop-blur-md px-3 lg:h-10 lg:px-4">
                    <div className="flex gap-1.5" aria-hidden="true">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-inner lg:h-3 lg:w-3" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-inner lg:h-3 lg:w-3" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-inner lg:h-3 lg:w-3" />
                    </div>
                    <div className="ml-2 flex h-5 flex-1 max-w-[240px] items-center rounded-full bg-white/80 border border-gray-200/50 px-3 lg:ml-4 lg:h-6 lg:max-w-[300px]">
                      <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse" aria-hidden="true" />
                      <span className="text-[10px] font-medium text-gray-600 lg:text-xs">
                        {t("home.hero.mockupUrl")}
                      </span>
                    </div>
                  </div>

                  {/* Dashboard Image */}
                  <div className="relative h-full w-full bg-gray-50">
                    {!imageLoaded && (
                      <Skeleton className="absolute inset-0 z-10 h-full w-full bg-gray-100" />
                    )}
                    <Image
                      src="/images/dashboard.png"
                      alt="Epidom Dashboard"
                      fill
                      className="object-cover object-left-top"
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      priority
                      sizes="(max-width: 768px) 100vw, 800px"
                      unoptimized
                    />
                  </div>
                </div>

                {/* Mobile Phone Mockup - Overlapping */}
                <div className="absolute -bottom-8 -left-8 w-32 lg:w-40 hidden md:block">
                  <div className="relative aspect-[9/19] w-full overflow-hidden rounded-3xl border-4 border-gray-800 bg-gray-800 shadow-2xl">
                    {/* Phone notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-5 bg-gray-800 rounded-b-xl z-20" aria-hidden="true" />

                    {/* Phone screen */}
                    <div className="relative h-full w-full bg-white overflow-hidden">
                      <Image
                        src="/images/tracking.png"
                        alt="Epidom Mobile App"
                        fill
                        className="object-cover object-top"
                        sizes="160px"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>

                {/* Floating notification card - using globals.css animation */}
                <div className="absolute -top-4 -right-4 lg:-top-6 lg:-right-6 bg-white rounded-xl shadow-xl border border-gray-100 p-3 lg:p-4 animate-bounce-slow hidden md:block">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white" aria-hidden="true">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{t("home.hero.notificationTitle")}</p>
                      <p className="text-[10px] text-gray-500">{t("home.hero.notificationDetail")}</p>
                    </div>
                  </div>
                </div>

                {/* Floating stats card */}
                <div className="absolute -bottom-4 right-8 lg:right-12 bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100 p-3 lg:p-4 hidden md:block">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-brand-primary">{t("home.hero.statsValue")}</div>
                    <div className="text-xs text-gray-500">{t("home.hero.statsLabel")}</div>
                  </div>
                </div>
              </div>

              {/* Decorative glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-amber-500/10 via-transparent to-blue-500/10 rounded-full blur-3xl -z-10" aria-hidden="true" />
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
