"use client";

import { useCallback, useState } from "react";
import { SectionErrorBoundary } from "@/components/shared";
import { trackEvent } from "@/lib/analytics";
import { CaseStudiesSection } from "./case-studies-section";
import { ComparisonTeaserSection } from "./comparison-teaser-section";
import { FinalCtaSection } from "./final-cta-section";
import { HeroSection } from "./hero-section";
import { MarginCalculatorSection } from "./margin-calculator-section";
import { MigrationModal } from "./migration-modal";
import { PricingSection } from "./pricing-section";
import { ProblemPickerSection } from "./problem-picker-section";
import { SourcesSection } from "./sources-section";
import { SwitchPaceSection } from "./switch-pace-section";
import { SwitcherFaqSection } from "./switcher-faq-section";
import { ThreeSpacesSection } from "./three-spaces-section";
import { TrustBar } from "./trust-bar";
import { WorksWithSection } from "./works-with-section";

/**
 * The home page, in the order of the homepage spec (28.09.2026): make
 * switching feel safe, and show what Epidom does for margin. Each section has
 * its own error boundary so one failing section never takes the page down.
 *
 * Two pieces of state are shared between sections: the "how do you want to
 * start" modal (opened from the hero and from "switch at your pace"), and the
 * commission rate the problem picker hands to the calculator.
 */
export function LandingPageSections({
  exampleStorefrontSlug,
}: {
  /** Streams in from the server page (see page.tsx); resolves to null on failure. */
  exampleStorefrontSlug: Promise<string | null> | string | null;
}) {
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [calculatorPreset, setCalculatorPreset] = useState<{
    commission: number;
    nonce: number;
  } | null>(null);

  const openMigration = useCallback((source: "hero" | "switch_section") => {
    setMigrationOpen(true);
    trackEvent("migration_modal_open", { source });
  }, []);

  const openCalculator = useCallback((preset?: { commission: number }) => {
    if (preset) setCalculatorPreset({ commission: preset.commission, nonce: Date.now() });
  }, []);

  return (
    <>
      <SectionErrorBoundary sectionName="Hero">
        <HeroSection onOpenMigration={() => openMigration("hero")} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Problem Picker">
        <ProblemPickerSection onOpenCalculator={openCalculator} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Margin Calculator">
        <MarginCalculatorSection preset={calculatorPreset} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Trust Bar">
        <TrustBar />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Three Spaces">
        <ThreeSpacesSection exampleStorefrontSlug={exampleStorefrontSlug} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Switch At Your Pace">
        <SwitchPaceSection onOpenMigration={() => openMigration("switch_section")} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Works With">
        <WorksWithSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Comparison Teaser">
        <ComparisonTeaserSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Pricing">
        <PricingSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Case Studies">
        <CaseStudiesSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Switcher FAQ">
        <SwitcherFaqSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Final CTA">
        <FinalCtaSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Sources">
        <SourcesSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Migration Modal">
        <MigrationModal open={migrationOpen} onClose={() => setMigrationOpen(false)} />
      </SectionErrorBoundary>
    </>
  );
}
