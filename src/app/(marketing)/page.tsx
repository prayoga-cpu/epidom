/**
 * Home Page (Landing Page)
 *
 * Main landing page for EPIDOM marketing site.
 * Features hero section with lazy-loaded components for performance.
 * Uses structured data for SEO and Open Graph metadata.
 *
 * @page
 */

import { LazyCountdownComponent, LazyHero } from "@/lib/dynamic-imports.client";
import { generateMetadata } from "@/lib/seo";
import { ProductStructuredData } from "@/components/seo/structured-data";

export const metadata = generateMetadata({
  title: "EPIDOM - Food Inventory Management Solution",
  description:
    "Revolutionary food inventory management system. Experience the future of restaurant inventory management with EPIDOM.",
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
  ],
  openGraph: {
    title: "EPIDOM - Food Inventory Management Solution",
    description:
      "Revolutionary food inventory management system. Experience the future of restaurant inventory management with EPIDOM.",
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
    description:
      "Revolutionary food inventory management system. Experience the future of restaurant inventory management with EPIDOM.",
    images: ["https://epidom.com/images/twitter-main.jpg"],
  },
});

export default function HomePage() {
  return (
    <main className="bg-white pt-12 md:pt-32 lg:pt-0">
      <ProductStructuredData />

      {/*
        ========================================
        DISPLAY MODE TOGGLE INSTRUCTIONS
        ========================================

        CURRENT STATE: Hero section is ACTIVE, Countdown is HIDDEN

        TO SHOW COUNTDOWN AND HIDE HERO:
          - Uncomment LazyCountdownComponent
          - Comment out Hero section

        TO SHOW HERO AND HIDE COUNTDOWN (current state):
          - LazyCountdownComponent is commented out
          - Hero section is active
        ========================================
      */}

      {/* COUNTDOWN SECTION - Currently HIDDEN (commented out) */}
      {/* <LazyCountdownComponent /> */}

      {/* HERO SECTION - Currently ACTIVE (visible) */}
      <div className="animate-slide-up">
        <LazyHero />
      </div>
    </main>
  );
}
