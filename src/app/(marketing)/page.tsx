/**
 * Home Page (Landing Page)
 *
 * Main landing page for EPIDOM marketing site.
 * Features hero section with lazy-loaded components for performance.
 * Uses structured data for SEO and Open Graph metadata.
 *
 * @page
 */

import { LazyHero } from "@/lib/dynamic-imports.client";
import { generateMetadata } from "@/lib/seo";
import { ProductStructuredData } from "@/components/seo/structured-data";
import { PainGainSection } from "@/features/marketing/shared/components/pain-gain-section";
import { CtaSection } from "@/features/marketing/shared/components/cta-section";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";

export const metadata = generateMetadata({
  title: "EPIDOM - Food Inventory Management Solution",
  description:
    "Revolutionary food inventory management system. Request a trial to experience the future of restaurant inventory management.",
  keywords: [
    "food inventory management",
    "restaurant management",
    "kitchen inventory",
    "food waste reduction",
    "stock management",
    "inventory tracking",
    "restaurant software",
    "food service management",
    "EPIDOM",
    "coming soon",
    "trial",
  ],
  openGraph: {
    title: "EPIDOM - Food Inventory Management Solution",
    description: "Revolutionary food inventory management system. Request a trial now!",
    url: "https://epidom.com",
    images: [
      {
        url: "https://epidom.com/images/og-main.jpg",
        width: 1200,
        height: 630,
        alt: "EPIDOM - Food Inventory Management",
      },
    ],
  },
  twitter: {
    title: "EPIDOM - Food Inventory Management Solution",
    description: "Revolutionary food inventory management system. Request a trial now!",
    images: ["https://epidom.com/images/twitter-countdown.jpg"],
  },
});

export default function HomePage() {
  return (
    <div className="home-page-snap h-screen w-full snap-y snap-mandatory overflow-x-hidden overflow-y-auto scroll-smooth bg-white">
      <ProductStructuredData />

      {/* 1. What is this? - Hero Section */}
      <div className="animate-slide-up h-screen w-full snap-start">
        <LazyHero />
      </div>

      {/* 2. Pain + Gain Section */}
      <div id="pain-gain" className="h-screen w-full snap-start">
        <PainGainSection />
      </div>

      {/* 3. Try now action button - CTA Section */}
      <div className="h-screen w-full snap-start">
        <CtaSection />
      </div>

      {/* 4. Footer - Snap to end */}
      <div className="w-full snap-start">
        <SiteFooter />
      </div>
    </div>
  );
}
