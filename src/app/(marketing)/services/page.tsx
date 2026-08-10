import { generateMetadata } from "@/lib/seo";
import { HeroSection } from "@/features/marketing/services/components/hero-section";
import { FeaturesShowcaseSection } from "@/features/marketing/services/components/features-showcase-section";
import { ClosingCtaSection } from "@/features/marketing/home/components/closing-cta-section";

export const metadata = generateMetadata({
  title: "Features — EPIDOM",
  description:
    "Everything Epidom offers: free menu page, POS cashier, kitchen display (KDS), inventory management, operational reports, and multi-outlet — for F&B businesses worldwide.",
  keywords: [
    "epidom features",
    "f&b pos app",
    "restaurant cashier app",
    "cafe inventory management",
    "digital menu page",
    "qris payments",
    "kitchen display system",
    "f&b operational reports",
  ],
  canonical: "https://epidom.fr/services",
  openGraph: {
    title: "Full Features — EPIDOM F&B Platform",
    description:
      "From free menu page to POS cashier and operational reports. One platform for cafés, warungs, and restaurants.",
    url: "https://epidom.fr/services",
  },
});

export default function ServicesPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <HeroSection />
      <FeaturesShowcaseSection />
      <ClosingCtaSection />
    </main>
  );
}
