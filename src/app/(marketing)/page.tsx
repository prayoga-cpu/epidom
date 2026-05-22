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
  title: "Epidom — Toko Online, Menu, dan Kasir untuk UMKM F&B Indonesia",
  description:
    "Bikin halaman menu untuk Instagram, terima pesanan QRIS, kelola kasir, semua gratis. Untuk warung, kafe, dan resto Indonesia.",
  keywords: [
    "aplikasi kasir gratis",
    "menu QR resto",
    "halaman pesanan instagram",
    "toko online F&B",
    "POS UMKM",
    "QRIS resto",
    "Epidom",
  ],
  openGraph: {
    title: "Epidom — Toko Online dan Kasir untuk F&B",
    description: "Halaman menu, pesanan online, dan kasir dalam satu link.",
    url: "https://epidom.id",
    locale: "id_ID",
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

