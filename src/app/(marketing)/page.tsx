/**
 * Home Page (Landing Page)
 *
 * Redesigned landing page for Cookie Bar inventory management.
 * Features 6 main sections in order:
 * 1. Hero Section - Main headline with CTAs
 * 2. Social Proof - Cookie bar logos & Instagram testimonials
 * 3. How to Use - Feature showcase
 * 4. Pricing - 3 tiers (Free promo, Pro, Custom)
 * 5. Pain+Gain - Old way vs Epidom way comparison
 * 6. Closing CTA - Final call-to-action
 *
 * @page
 */

import { generateMetadata } from "@/lib/seo";
import { ProductStructuredData } from "@/components/seo/structured-data";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";
import {
  HeroSection,
  SocialProofSection,
  HowToUseSection,
  PricingSection,
  PainGainSection,
  ClosingCtaSection,
} from "@/features/marketing/home/components";

export const metadata = generateMetadata({
  title: "EPIDOM - Secret Way of Cookie Bars Inventory Management",
  description:
    "Track your cookies stock on mobile, manage it everywhere real-time, & auto-restock in seconds. Trusted by cookie bars in France 🇫🇷",
  keywords: [
    "cookie bar inventory",
    "bakery management",
    "pastry inventory",
    "food stock management",
    "real-time tracking",
    "France inventory system",
    "cookie inventory software",
    "bakery software",
    "EPIDOM",
  ],
  openGraph: {
    title: "EPIDOM - Cookie Bar Inventory Management System",
    description: "The secret way cookie bars in France manage their inventory. Real-time tracking & smart alerts.",
    url: "https://epidom.com",
    images: [
      {
        url: "https://epidom.com/images/og-cookie-bar.jpg",
        width: 1200,
        height: 630,
        alt: "EPIDOM Cookie Bar Management",
      },
    ],
  },
  twitter: {
    title: "EPIDOM - Cookie Bar Inventory Management",
    description: "Track cookies stock in real-time, manage everywhere, auto-restock in seconds.",
    images: ["https://epidom.com/images/twitter-cookie-bar.jpg"],
  },
});

export default function HomePage() {
  return (
    <>
      <ProductStructuredData />

      <main className="w-full overflow-x-hidden bg-white">
        {/* Section 1: Hero */}
        <HeroSection />

        {/* Section 2: Social Proof (Logo Carousel + Instagram) */}
        <SocialProofSection />

        {/* Section 3: How to Use */}
        <HowToUseSection />

        {/* Section 4: Pricing */}
        <PricingSection />

        {/* Section 5: Pain+Gain Comparison */}
        <PainGainSection />

        {/* Section 6: Closing CTA */}
        <ClosingCtaSection />

        {/* Footer */}
        <SiteFooter />
      </main>
    </>
  );
}
