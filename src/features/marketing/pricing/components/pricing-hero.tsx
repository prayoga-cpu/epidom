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
import { Container } from "@/features/marketing/shared/components/container";

export function PricingHero() {
  const { t } = useI18n();

  return (
    <section className="py-8 md:py-12 lg:py-16">
      <Container maxWidth="7xl">
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
          <h1 className="mb-6 text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-brand-primary">
            {t("pricing.heroTitle")}
          </h1>

          {/* Description */}
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-brand-primary/80 md:text-xl lg:text-2xl">
            {t("pricing.heroDescription")}
          </p>
        </div>
      </Container>
    </section>
  );
}
