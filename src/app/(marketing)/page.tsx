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
 * Each section is wrapped with an error boundary to prevent
 * one section's failure from crashing the entire page.
 *
 * @page
 */

import { generateMetadata } from "@/lib/seo";
import { ProductStructuredData } from "@/components/seo/structured-data";
import { LandingPageSections } from "@/features/marketing/home/components/landing-page-sections";

export const metadata = generateMetadata({
  title: "Epidom — Online Store, Menu & POS for F&B Businesses",
  description:
    "Create a menu page for Instagram, accept QRIS payments, manage your cashier — all free. For cafés, warungs, and restaurants worldwide.",
  keywords: [
    "free pos app",
    "digital menu qr code",
    "online food ordering",
    "f&b storefront",
    "restaurant pos cashier",
    "qris payments",
    "kitchen display system",
    "epidom",
  ],
  openGraph: {
    title: "Epidom — Online Store & POS for F&B",
    description: "Menu page, online orders, and POS cashier in one link. Free forever.",
    url: "https://epidom.fr",
    locale: "en_US",
  },
});

export default function HomePage() {
  return (
    <>
      <ProductStructuredData />

      <main className="w-full overflow-x-hidden">
        <LandingPageSections />
      </main>
    </>
  );
}

