import { PageTitle } from "@/features/marketing/services/components/page-title";
import { SpacesSection } from "@/features/marketing/services/components/spaces-section";
import { FeaturesShowcaseSection } from "@/features/marketing/services/components/features-showcase-section";
import { ClosingCtaSection } from "@/features/marketing/home/components/closing-cta-section";
import { ProblemPickerSection } from "@/features/marketing/home/components/problem-picker-section";
import { PosTourSection } from "@/features/marketing/home/components/pos-tour-section";
import { PricingClaudeStrip } from "@/features/marketing/pricing/components/pricing-claude-strip";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("products");

/**
 * The Products page (/products; it was /services, "Features", until
 * 2026-11-06, and the old address redirects here, see src/proxy.ts). It opens
 * on "Which problem costs you the most?" (moved here from the home page,
 * 11.10.2026); the title is for screen readers only (see PageTitle). The POS
 * tour (real screens) follows the three spaces.
 */
export default function ProductsPage() {
  return (
    <div className="w-full overflow-x-clip">
      <PageTitle />
      <ProblemPickerSection />
      <SpacesSection />
      <PosTourSection />
      <PricingClaudeStrip surface="products" />
      <FeaturesShowcaseSection />
      <ClosingCtaSection />
    </div>
  );
}
