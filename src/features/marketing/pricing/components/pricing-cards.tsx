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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export const PricingCards = memo(function PricingCards() {
  const { t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.9; // Scroll by ~90% of container width
      container.scrollBy({
        left: -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.9; // Scroll by ~90% of container width
      container.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Scroll to center card (Pro Plan) on initial mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const proCard = container.querySelector('[data-card="pro"]') as HTMLElement;

      if (proCard) {
        // Calculate scroll position to center the Pro card
        const cardRect = proCard.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;

        // Center the card in the viewport
        const targetScroll = scrollLeft + cardRect.left - containerRect.left - (containerRect.width / 2) + (cardRect.width / 2);

        // Scroll to center card immediately on mount
        container.scrollTo({
          left: targetScroll,
          behavior: "auto", // Instant scroll, no animation
        });
      }
    }
  }, []);

  return (
    <section className="pb-12 md:pb-20 lg:pb-24" data-section="pricing-cards">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden gap-6 lg:grid lg:grid-cols-3">
          {/* Starter Plan */}
          <Card className="flex flex-col rounded-2xl border-2">
            <CardHeader className="pb-4">
              <CardTitle
                className="text-2xl font-bold"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {t("pricing.plans.starter.title")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("pricing.plans.starter.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div>
                <div className="text-4xl font-bold" style={{ color: "var(--color-brand-primary)" }}>
                  €29
                </div>
                <p className="text-sm" style={{ color: "var(--color-brand-primary)" }}>
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

          {/* Pro Plan - Highlighted */}
          <Card className="border-primary md:ring-primary relative flex scale-105 flex-col rounded-2xl border-2 shadow-lg md:scale-100 md:ring-2">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
              <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold">
                {t("pricing.plans.pro.recommended")}
              </span>
            </div>
            <CardHeader className="pt-8 pb-4">
              <CardTitle
                className="text-2xl font-bold"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {t("pricing.plans.pro.title")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("pricing.plans.pro.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div>
                <div className="text-4xl font-bold" style={{ color: "var(--color-brand-primary)" }}>
                  €79
                </div>
                <p className="text-sm" style={{ color: "var(--color-brand-primary)" }}>
                  {t("pricing.plans.pro.billing")}
                </p>
              </div>
              <Button asChild className="w-full rounded-lg">
                <Link href="/payments?plan=pro">{t("pricing.plans.pro.select")}</Link>
              </Button>
              <Separator />
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.pro.f1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.pro.f2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.pro.f3")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.pro.f4")}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="flex flex-col rounded-2xl border-2">
            <CardHeader className="pb-4">
              <CardTitle
                className="text-2xl font-bold"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {t("pricing.plans.enterprise.title")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("pricing.plans.enterprise.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div>
                <div className="text-3xl font-bold" style={{ color: "var(--color-brand-primary)" }}>
                  {t("pricing.plans.enterprise.price")}
                </div>
                <p className="text-sm" style={{ color: "var(--color-brand-primary)" }}>
                  {t("pricing.plans.enterprise.billing")}
                </p>
              </div>
              <Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
                <Link href="/payments?plan=enterprise">{t("pricing.plans.enterprise.select")}</Link>
              </Button>
              <Separator />
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.enterprise.f1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.enterprise.f2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{t("pricing.plans.enterprise.f3")}</span>
                </li>
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
                  <CardTitle
                    className="text-2xl font-bold"
                    style={{ color: "var(--color-brand-primary)" }}
                  >
                    {t("pricing.plans.starter.title")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricing.plans.starter.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div>
                    <div
                      className="text-4xl font-bold"
                      style={{ color: "var(--color-brand-primary)" }}
                    >
                      €29
                    </div>
                    <p className="text-sm" style={{ color: "var(--color-brand-primary)" }}>
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

              {/* Pro Plan - Highlighted */}
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
                  <CardTitle
                    className="text-2xl font-bold"
                    style={{ color: "var(--color-brand-primary)" }}
                  >
                    {t("pricing.plans.pro.title")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricing.plans.pro.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div>
                    <div
                      className="text-4xl font-bold"
                      style={{ color: "var(--color-brand-primary)" }}
                    >
                      €79
                    </div>
                    <p className="text-sm" style={{ color: "var(--color-brand-primary)" }}>
                      {t("pricing.plans.pro.billing")}
                    </p>
                  </div>
                  <Button asChild className="w-full rounded-lg">
                    <Link href="/payments?plan=pro">{t("pricing.plans.pro.select")}</Link>
                  </Button>
                  <Separator />
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.pro.f1")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.pro.f2")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.pro.f3")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.pro.f4")}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Enterprise Plan */}
              <Card className="flex min-w-[78vw] flex-shrink-0 snap-start snap-always flex-col rounded-2xl border-2 sm:min-w-[360px] md:min-w-[420px]">
                <CardHeader className="pb-4">
                  <CardTitle
                    className="text-2xl font-bold"
                    style={{ color: "var(--color-brand-primary)" }}
                  >
                    {t("pricing.plans.enterprise.title")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricing.plans.enterprise.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div>
                    <div
                      className="text-3xl font-bold"
                      style={{ color: "var(--color-brand-primary)" }}
                    >
                      {t("pricing.plans.enterprise.price")}
                    </div>
                    <p className="text-sm" style={{ color: "var(--color-brand-primary)" }}>
                      {t("pricing.plans.enterprise.billing")}
                    </p>
                  </div>
                  <Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
                    <Link href="/payments?plan=enterprise">
                      {t("pricing.plans.enterprise.select")}
                    </Link>
                  </Button>
                  <Separator />
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.enterprise.f1")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.enterprise.f2")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{t("pricing.plans.enterprise.f3")}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
