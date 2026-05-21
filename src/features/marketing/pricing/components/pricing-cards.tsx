"use client";

/**
 * Pricing Cards Component
 *
 * Interactive pricing cards for Starter, Pro, and Enterprise plans.
 * Features:
 * - Horizontal scroll on mobile/tablet with navigation buttons
 * - Auto-centers Pro plan on initial load
 * - Desktop grid layout
 * - Smooth scrolling
 *
 * @component
 */

import { memo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { Check, ChevronLeft, ChevronRight, Clock, Gift, Sparkles, ArrowRight } from "lucide-react";
import { Container } from "@/features/marketing/shared/components/container";


export const PricingCards = memo(function PricingCards() {
  const { t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.9;
      container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.9;
      container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Scroll to center card (Pro Plan) on initial mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const proCard = container.querySelector('[data-card="pro"]') as HTMLElement;

      if (proCard) {
        const cardRect = proCard.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const targetScroll =
          scrollLeft +
          cardRect.left -
          containerRect.left -
          containerRect.width / 2 +
          cardRect.width / 2;

        container.scrollTo({ left: targetScroll, behavior: "auto" });
      }
    }
  }, []);

  return (
    <section className="pb-12 md:pb-20 lg:pb-24" data-section="pricing-cards">
      <Container maxWidth="7xl">

        {/* ========================================
            PROMO BANNER (Copied from Homepage)
            ======================================== */}
        <div className="mb-16 from-brand-primary to-brand-primary relative overflow-hidden rounded-3xl bg-gradient-to-r via-brand-primary/90 p-8 shadow-2xl transition-all duration-1000 md:p-12">
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
              <span className="text-5xl font-black text-white md:text-6xl lg:text-7xl">{t("pricing.plans.free.price")}</span>
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

        {/* Desktop Layout - 3 Columns */}
        <div className="hidden gap-6 lg:grid lg:grid-cols-3">
          {/* Starter Plan (Original) */}
          <Card className="flex flex-col rounded-2xl border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-brand-primary">
                {t("pricing.plans.starter.title")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("pricing.plans.starter.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div>
                <div className="text-4xl font-bold text-brand-primary">{t("pricing.plans.starter.price")}</div>
                <p className="text-sm text-brand-primary">
                  {t("pricing.plans.starter.billing")}
                </p>
              </div>
              <Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
                <Link href="/payments?plan=starter">{t("pricing.plans.starter.select")}</Link>
              </Button>
              <Separator />
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.starter.f1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.starter.f2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.starter.f3")}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Pro Plan (Updated to match Homepage) */}
          <Card className="border-primary md:ring-primary relative flex scale-105 flex-col rounded-2xl border-2 shadow-lg md:scale-100 md:ring-2">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
              <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold">
                {t("pricing.plans.pro.recommended")}
              </span>
            </div>
            <CardHeader className="pt-8 pb-4">
              <CardTitle className="text-2xl font-bold text-brand-primary">
                {t("home.pricing.pro.name")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("pricing.plans.pro.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div>
                <div className="text-4xl font-bold text-brand-primary">{t("pricing.plans.pro.price")}</div>
                <p className="text-sm text-brand-primary">
                  {t("pricing.plans.pro.billing")}
                </p>
              </div>
              <Button asChild className="w-full rounded-lg">
                <Link href="/payments?plan=pro">{t("home.pricing.cta")}</Link>
              </Button>
              <Separator />
              {/* Homepage Feature List */}
              <ul className="space-y-3">
                {["multiStore", "unlimited", "advanced", "priority", "whatsapp"].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{t(`home.pricing.pro.features.${feature}`)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Enterprise Plan (Updated to match Homepage) */}
          <Card className="flex flex-col rounded-2xl border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-brand-primary">
                {t("home.pricing.custom.name")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("pricing.plans.enterprise.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div>
                <div className="text-3xl font-bold text-brand-primary">
                  {t("pricing.plans.enterprise.price")}
                </div>
                <p className="text-sm text-brand-primary">
                  {t("pricing.plans.enterprise.billing")}
                </p>
              </div>
              <Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
                <Link href="https://calendly.com/prayogadevelopment/30min" target="_blank">{t("home.pricing.custom.cta")}</Link>
              </Button>
              <Separator />
               {/* Homepage Feature List */}
              <ul className="space-y-3">
                 {["franchise", "dedicated", "custom", "onboarding"].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{t(`home.pricing.custom.features.${feature}`)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Mobile/Tablet Horizontal Scroll Layout */}
        <div className="relative py-6 md:py-10 lg:hidden">
          {/* Left Navigation Button */}
          <button
            onClick={scrollLeft}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow-lg backdrop-blur-sm opacity-20 transition-opacity hover:opacity-80 md:left-4"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
          </button>

          {/* Right Navigation Button */}
          <button
            onClick={scrollRight}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow-lg backdrop-blur-sm opacity-20 transition-opacity hover:opacity-80 md:right-4"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
          </button>

          <div
            ref={scrollContainerRef}
            className="scrollbar-hide snap-x snap-mandatory overflow-x-auto overflow-y-visible scroll-smooth"
          >
            <div className="flex gap-6 pl-4 pr-4 pt-8 pb-8 md:gap-8 md:pl-8 md:pr-4">
              {/* Starter Plan */}
              <Card className="flex min-w-[78vw] flex-shrink-0 snap-start snap-always flex-col rounded-2xl border-2 sm:min-w-[360px] md:min-w-[420px]">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl font-bold text-brand-primary">
                    {t("pricing.plans.starter.title")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricing.plans.starter.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div>
                    <div className="text-4xl font-bold text-brand-primary">{t("pricing.plans.starter.price")}</div>
                    <p className="text-sm text-brand-primary">
                      {t("pricing.plans.starter.billing")}
                    </p>
                  </div>
                  <Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
                    <Link href="/payments?plan=starter">{t("pricing.plans.starter.select")}</Link>
                  </Button>
                  <Separator />
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.starter.f1")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.starter.f2")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.starter.f3")}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card
                data-card="pro"
                className="border-primary relative flex min-w-[78vw] flex-shrink-0 snap-center snap-always scale-100 sm:scale-105 flex-col rounded-2xl border-2 shadow-lg sm:min-w-[360px] md:min-w-[420px]"
              >
                <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 transform">
                  <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold shadow-lg">
                    {t("pricing.plans.pro.recommended")}
                  </span>
                </div>
                <CardHeader className="pt-8 pb-4">
                  <CardTitle className="text-2xl font-bold text-brand-primary">
                     {t("home.pricing.pro.name")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricing.plans.pro.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div>
                    <div className="text-4xl font-bold text-brand-primary">{t("pricing.plans.pro.price")}</div>
                    <p className="text-sm text-brand-primary">
                      {t("pricing.plans.pro.billing")}
                    </p>
                  </div>
                  <Button asChild className="w-full rounded-lg">
                    <Link href="/payments?plan=pro">{t("home.pricing.cta")}</Link>
                  </Button>
                  <Separator />
                  <ul className="space-y-3">
                    {["multiStore", "unlimited", "advanced", "priority", "whatsapp"].map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{t(`home.pricing.pro.features.${feature}`)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Enterprise Plan */}
              <Card className="flex min-w-[78vw] flex-shrink-0 snap-start snap-always flex-col rounded-2xl border-2 sm:min-w-[360px] md:min-w-[420px]">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl font-bold text-brand-primary">
                     {t("home.pricing.custom.name")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricing.plans.enterprise.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div>
                    <div className="text-3xl font-bold text-brand-primary">
                      {t("pricing.plans.enterprise.price")}
                    </div>
                    <p className="text-sm text-brand-primary">
                      {t("pricing.plans.enterprise.billing")}
                    </p>
                  </div>
                  <Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
                    <Link href="https://calendly.com/prayogadevelopment/30min" target="_blank">{t("home.pricing.custom.cta")}</Link>
                  </Button>
                  <Separator />
                  <ul className="space-y-3">
                    {["franchise", "dedicated", "custom", "onboarding"].map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{t(`home.pricing.custom.features.${feature}`)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
});
