"use client";

/**
 * Legal Page Hero Component
 *
 * Reusable hero section for legal pages (Terms, Refund Policy, etc.)
 * Displays logo, title, and last updated date with consistent styling.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "./container";
import { LogoWithSkeleton } from "./logo-with-skeleton";

interface LegalPageHeroProps {
  /** Translation key for the page title */
  titleKey: string;
  /** Translation key for "Last Updated" label */
  lastUpdatedKey: string;
  /** Translation key for the last updated date */
  lastUpdatedDateKey: string;
}

export function LegalPageHero({
  titleKey,
  lastUpdatedKey,
  lastUpdatedDateKey,
}: LegalPageHeroProps) {
  const { t } = useI18n();

  return (
    <section className="border-b border-gray-200 pb-8 md:pb-12">
      <Container maxWidth="4xl">
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
          <h1 className="mb-4 text-3xl leading-tight font-bold tracking-tight md:mb-6 md:text-5xl lg:text-6xl text-brand-primary">
            {t(titleKey)}
          </h1>

          {/* Last Updated */}
          <p className="text-base text-gray-600 md:text-lg">
            {t(lastUpdatedKey)} {t(lastUpdatedDateKey)}
          </p>
        </div>
      </Container>
    </section>
  );
}






