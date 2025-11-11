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
  title: "EPIDOM - Food Inventory Management Solution | Coming Soon",
  description:
    "Revolutionary food inventory management system launching November 12, 2025. Join our waitlist to be the first to experience the future of restaurant inventory management.",
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
    "waitlist",
  ],
  openGraph: {
    title: "EPIDOM - Food Inventory Management Solution | Coming Soon",
    description:
      "Revolutionary food inventory management system launching November 12, 2025. Join our waitlist now!",
    url: "https://epidom.com",
    images: [
      {
        url: "https://epidom.com/images/og-countdown.jpg",
        width: 1200,
        height: 630,
        alt: "EPIDOM Coming Soon - Food Inventory Management",
      },
    ],
  },
  twitter: {
    title: "EPIDOM - Food Inventory Management Solution | Coming Soon",
    description:
      "Revolutionary food inventory management system launching November 12, 2025. Join our waitlist now!",
    images: ["https://epidom.com/images/twitter-countdown.jpg"],
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
          1. Uncomment the LazyCountdownComponent line below (remove comment markers)
          2. Comment out the Hero section div block below

        TO SHOW HERO AND HIDE COUNTDOWN (current state):
          1. Comment out the LazyCountdownComponent line below
          2. Uncomment the Hero section div block below

        AI/ROBOT INSTRUCTIONS:
          - Prompt: "show countdown, hide hero" -> uncomment countdown, comment hero
          - Prompt: "show hero, hide countdown" -> comment countdown, uncomment hero
          - Prompt: "activate countdown mode" -> uncomment countdown, comment hero
          - Prompt: "activate hero mode" -> comment countdown, uncomment hero
        ========================================
      */}

      {/* COUNTDOWN SECTION - Currently HIDDEN (commented out) */}
      {/* To activate: Remove the comment markers around the next line */}
      {/* <LazyCountdownComponent /> */}

      {/* HERO SECTION - Currently ACTIVE (visible) */}
      {/* To hide: Wrap the div block below with comment markers */}
      <div className="animate-slide-up">
        <LazyHero />
      </div>
    </main>
  );
}
