"use client";

import { SectionErrorBoundary } from "@/components/shared";
import {
  HeroSection,
  TrustBar,
  WhatYouGetSection,
  HowItWorksSection,
  FeatureLadderSection,
  PainGainSection,
  SocialProofSection,
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

      <SectionErrorBoundary sectionName="What You Get">
        <WhatYouGetSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="How It Works">
        <HowItWorksSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Feature Ladder">
        <FeatureLadderSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Pain Gain">
        <PainGainSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Testimonials">
        <SocialProofSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="CTA">
        <ClosingCtaSection />
      </SectionErrorBoundary>
    </>
  );
}
