import { PageTitle } from "@/features/marketing/services/components/page-title";
import { SpacesSection } from "@/features/marketing/services/components/spaces-section";
import { FeaturesShowcaseSection } from "@/features/marketing/services/components/features-showcase-section";
import { ClosingCtaSection } from "@/features/marketing/home/components/closing-cta-section";
import { ProblemPickerSection } from "@/features/marketing/home/components/problem-picker-section";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("services");

/**
 * The Features page. It opens on "Which problem costs you the most?" (moved
 * here from the home page, 11.10.2026); the title is for screen readers only
 * (see PageTitle).
 */
export default function ServicesPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <PageTitle />
      <ProblemPickerSection />
      <SpacesSection />
      <FeaturesShowcaseSection />
      <ClosingCtaSection />
    </main>
  );
}
