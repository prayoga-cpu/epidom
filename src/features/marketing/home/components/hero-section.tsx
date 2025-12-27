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
        {/* Floating gradient orbs */}
        <div className="absolute top-20 left-10 h-72 w-72 animate-pulse rounded-full bg-gray-200/30 blur-3xl" />
        <div className="absolute right-10 bottom-20 h-96 w-96 animate-pulse rounded-full bg-gray-300/20 blur-3xl delay-1000" />
        <div className="bg-gradient-radial absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full from-gray-100/50 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <Container maxWidth="7xl" className="w-full">
          <div className="grid w-full grid-cols-1 content-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left Column: Text Content */}
            <div
              className={`z-10 flex flex-col justify-center text-center transition-all duration-1000 lg:text-left ${
                mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
            >
              <div className="space-y-6 lg:space-y-8">
                {/* Headline with gradient - using globals.css animation */}
                <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl md:text-5xl lg:text-[3.25rem] xl:text-[4rem]">
                  <span className="text-brand-primary">{t("home.hero.headlinePart1")}</span>{" "}
                  <span className="animate-gradient-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                    {t("home.hero.headlineHighlight")}
                  </span>{" "}
                  <span className="text-brand-primary">{t("home.hero.headlinePart2")}</span>
                </h1>

                {/* Description */}
                <p className="text-brand-primary/70 mx-auto max-w-xl text-lg leading-relaxed sm:text-xl lg:mx-0 lg:text-lg xl:text-xl">
                  {t("home.hero.description")}
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row lg:justify-start">
                  <Button
                    onClick={handleStartFree}
                    className="group bg-brand-primary hover:bg-brand-primary/90 relative cursor-pointer overflow-hidden rounded-full px-8 py-6 text-base font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-xl"
                  >
                    <span className="relative z-10 flex items-center">
                      {t("home.hero.ctaStartFree")}
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  </Button>

                  <Button
                    onClick={handleDemo}
                    variant="outline"
                    className="group border-brand-primary/30 text-brand-primary hover:bg-brand-primary hover:border-brand-primary cursor-pointer rounded-full border-2 px-8 py-6 text-base font-semibold transition-all duration-300 hover:text-white"
                  >
                    <Calendar className="mr-2 h-5 w-5" />
                    {t("home.hero.ctaDemo")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Dashboard Mockup with Devices */}
            <div
              className={`relative flex h-full w-full flex-col justify-center transition-all delay-300 duration-1000 ${
                mounted ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
              }`}
            >
              {/* Desktop Browser Window */}
              <div className="relative w-full">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-2xl lg:aspect-[16/10] lg:rounded-2xl">
                  {/* Browser Header - Glassmorphism */}
                  <div className="flex h-8 shrink-0 items-center gap-2 border-b border-gray-200/50 bg-gray-50/80 px-3 backdrop-blur-md lg:h-10 lg:px-4">
                    <div className="flex gap-1.5" aria-hidden="true">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-inner lg:h-3 lg:w-3" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-inner lg:h-3 lg:w-3" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-inner lg:h-3 lg:w-3" />
                    </div>
                    <div className="ml-2 flex h-5 max-w-[240px] flex-1 items-center rounded-full border border-gray-200/50 bg-white/80 px-3 lg:ml-4 lg:h-6 lg:max-w-[300px]">
                      <div
                        className="mr-2 h-3 w-3 animate-pulse rounded-full bg-green-500"
                        aria-hidden="true"
                      />
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
                <div className="absolute -bottom-8 -left-8 hidden w-32 md:block lg:w-40">
                  <div className="relative aspect-[9/19] w-full overflow-hidden rounded-3xl border-4 border-gray-800 bg-gray-800 shadow-2xl">
                    {/* Phone notch */}
                    <div
                      className="absolute top-0 left-1/2 z-20 h-5 w-16 -translate-x-1/2 rounded-b-xl bg-gray-800"
                      aria-hidden="true"
                    />

                    {/* Phone screen */}
                    <div className="relative h-full w-full overflow-hidden bg-white">
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
                <div className="animate-bounce-slow absolute -top-4 -right-4 hidden rounded-xl border border-gray-100 bg-white p-3 shadow-xl md:block lg:-top-6 lg:-right-6 lg:p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white"
                      aria-hidden="true"
                    >
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {t("home.hero.notificationTitle")}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {t("home.hero.notificationDetail")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Floating stats card */}
                <div className="absolute right-8 -bottom-4 hidden rounded-xl border border-gray-100 bg-white/90 p-3 shadow-xl backdrop-blur-sm md:block lg:right-12 lg:p-4">
                  <div className="flex items-center gap-2">
                    <div className="text-brand-primary text-2xl font-bold">
                      {t("home.hero.statsValue")}
                    </div>
                    <div className="text-xs text-gray-500">{t("home.hero.statsLabel")}</div>
                  </div>
                </div>
              </div>

              {/* Decorative glow */}
              <div
                className="absolute top-1/2 left-1/2 -z-10 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-gray-200/20 via-transparent to-gray-200/20 blur-3xl"
                aria-hidden="true"
              />
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
