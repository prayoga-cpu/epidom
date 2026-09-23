import { HeroSection } from "@/features/marketing/services/components/hero-section";
import { FeaturesShowcaseSection } from "@/features/marketing/services/components/features-showcase-section";
import { ClosingCtaSection } from "@/features/marketing/home/components/closing-cta-section";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("services");

export default function ServicesPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <HeroSection />
      <FeaturesShowcaseSection />
      <ClosingCtaSection />
    </main>
  );
}
