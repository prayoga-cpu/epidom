/**
 * Pricing Page
 *
 * Displays EPIDOM pricing plans and feature comparison.
 * Sections: Hero, Pricing Cards, Feature Comparison, FAQ, CTA
 *
 * @page
 */

import { PricingHero } from "@/features/marketing/pricing/components/pricing-hero";
import { PricingCards } from "@/features/marketing/pricing/components/pricing-cards";
import { FeatureComparison } from "@/features/marketing/pricing/components/feature-comparison";
import { PricingFaq } from "@/features/marketing/pricing/components/pricing-faq";
import { PricingCta } from "@/features/marketing/pricing/components/pricing-cta";

export default function PricingPage() {
  return (
    <main className="w-full overflow-x-hidden bg-white pt-20 md:pt-24">
      <div className="animate-slide-up">
        <PricingHero />
      </div>
      <div className="animate-slide-up-delayed">
        <PricingCards />
      </div>
      <div className="animate-slide-up-delayed-2">
        <FeatureComparison />
      </div>
      <div className="animate-slide-up-delayed-3">
        <PricingFaq />
      </div>
      <div className="animate-slide-up-delayed-3">
        <PricingCta />
      </div>
    </main>
  );
}
