"use client";

/**
 * Landing Page Sections Wrapper
 *
 * Wraps each section with an error boundary to prevent
 * one section's failure from crashing the entire page.
 *
 * @component
 */

import { SectionErrorBoundary } from "@/components/shared";
import {
  HeroSection,
  SocialProofSection,
  HowToUseSection,
  PricingSection,
  PainGainSection,
  ClosingCtaSection,
} from "@/features/marketing/home/components";

export function LandingPageSections() {
  return (
    <>
      {/* Section 1: Hero */}
      <SectionErrorBoundary sectionName="Hero">
        <HeroSection />
      </SectionErrorBoundary>

      {/* Section 2: Social Proof (Logo Carousel + Instagram) */}
      <SectionErrorBoundary sectionName="Social Proof">
        <SocialProofSection />
      </SectionErrorBoundary>

      {/* Section 3: How to Use */}
      <SectionErrorBoundary sectionName="Features">
        <HowToUseSection />
      </SectionErrorBoundary>

      {/* Section 4: Pricing */}
      <SectionErrorBoundary sectionName="Pricing">
        <PricingSection />
      </SectionErrorBoundary>

      {/* Section 5: Pain+Gain Comparison */}
      <SectionErrorBoundary sectionName="Comparison">
        <PainGainSection />
      </SectionErrorBoundary>

      {/* Section 6: Closing CTA */}
      <SectionErrorBoundary sectionName="CTA">
        <ClosingCtaSection />
      </SectionErrorBoundary>
    </>
  );
}
