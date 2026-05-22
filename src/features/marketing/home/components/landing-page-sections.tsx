"use client";

import { SectionErrorBoundary } from "@/components/shared";
import {
  HeroSection,
  TrustBar,
  HowItWorksSection,
  PainGainSection,
  FeatureLadderSection,
  WhatYouGetSection,
  DashboardPreviewSection,
  UseCasesSection,
  HowToUseSection,
  SocialProofSection,
  PricingSection,
  FaqSection,
  ClosingCtaSection,
} from "@/features/marketing/home/components";

export function LandingPageSections() {
  return (
    <>
      <SectionErrorBoundary sectionName="Hero">
        <HeroSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Trust Bar">
        <TrustBar />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="How It Works">
        <HowItWorksSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Old vs New">
        <PainGainSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Core Products">
        <FeatureLadderSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Features Grid">
        <WhatYouGetSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Dashboard Preview">
        <DashboardPreviewSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Use Cases">
        <UseCasesSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Setup Steps">
        <HowToUseSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Testimonials">
        <SocialProofSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Pricing Teaser">
        <PricingSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="FAQ">
        <FaqSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="CTA Banner">
        <ClosingCtaSection />
      </SectionErrorBoundary>
    </>
  );
}
