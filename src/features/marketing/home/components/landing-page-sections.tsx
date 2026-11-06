"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionErrorBoundary } from "@/components/shared";
import { trackEvent } from "@/lib/analytics";
import { CaseStudiesSection } from "./case-studies-section";
import { ComplianceSection } from "./compliance-section";
import { FinalCtaSection } from "./final-cta-section";
import { HeroSection } from "./hero-section";
import { HubSection } from "./hub-section";
import { MarginCalculatorSection } from "./margin-calculator-section";
import { MigrationModal } from "./migration-modal";
import { PosTourSection } from "./pos-tour-section";
import { PricingSection } from "./pricing-section";
import { SwitcherFaqSection } from "./switcher-faq-section";
import { ThreeSpacesSection } from "./three-spaces-section";
import { TrustBar } from "./trust-bar";
import { UsesSection } from "./uses-section";

/**
 * The home page, in the order of the homepage spec (28.09.2026), except that
 * the POS tour (real screens, 13.10.2026) and then "one link, three spaces"
 * come straight after the hero, and the problem picker has moved to the top of
 * /products (11.10.2026): make switching feel
 * safe, and show what Epidom does for margin. Each section has its own error
 * boundary so one failing section never takes the page down.
 *
 * The "how do you want to start" modal is shared between sections (opened from
 * the hero and from "switch at your pace"). The calculator takes a commission
 * rate from the URL: the problem picker's commissions button lands here on
 * `?commission=30#calculator`.
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

  // Read once on arrival: the problem picker on /products links here with
  // ?commission=, and the calculator only needs the rate when it mounts.
  useEffect(() => {
    const commission = Number(new URLSearchParams(window.location.search).get("commission"));
    if (commission > 0 && commission <= 100) {
      setCalculatorPreset({ commission, nonce: Date.now() });
    }
  }, []);

  return (
    <>
      <SectionErrorBoundary sectionName="Hero">
        <HeroSection onOpenMigration={() => openMigration("hero")} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Uses">
        <UsesSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="POS Tour">
        <PosTourSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Three Spaces">
        <ThreeSpacesSection exampleStorefrontSlug={exampleStorefrontSlug} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Hub">
        <HubSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Margin Calculator">
        <MarginCalculatorSection preset={calculatorPreset} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Pricing">
        <PricingSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Trust Bar">
        <TrustBar />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Compliance">
        <ComplianceSection />
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

      <SectionErrorBoundary sectionName="Migration Modal">
        <MigrationModal open={migrationOpen} onClose={() => setMigrationOpen(false)} />
      </SectionErrorBoundary>
    </>
  );
}
