"use client";

/**
 * Pricing Hero Section
 *
 * Hero banner for pricing page with logo, title, and description.
 * Centered layout with brand logo at top.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { LogoWithSkeleton } from "@/features/marketing/shared/components/logo-with-skeleton";

export function PricingHero() {
  const { t } = useI18n();

  return (
    <section className="py-8 md:py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-6 md:mb-8">
            <LogoWithSkeleton
              src="/images/logo-black.png"
              alt="EPIDOM"
              filter="invert(27%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(96%) contrast(80%)"
              wrapperClassName="relative mx-auto h-8 w-[120px] flex items-center justify-center"
            />
          </div>

          {/* Title */}
          <h1
            className="mb-4 text-3xl leading-tight font-bold tracking-tight md:mb-6 md:text-5xl lg:text-6xl"
            style={{ color: "var(--color-brand-primary)" }}
          >
            {t("pricing.heroTitle")}
          </h1>

          {/* Description */}
          <p
            className="mx-auto max-w-4xl text-lg leading-relaxed md:text-2xl"
            style={{ color: "var(--color-brand-primary)" }}
          >
            {t("pricing.heroDescription")}
          </p>
        </div>
      </div>
    </section>
  );
}
