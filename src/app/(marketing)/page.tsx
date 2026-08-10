/**
 * Home Page (Landing Page)
 *
 * Landing page for Epidom's free F&B storefront + POS platform.
 * Composed of the sections in landing-page-sections.tsx (hero, trust bar,
 * how-it-works, pricing teaser, pain/gain, use cases, FAQ, closing CTA).
 * Each section is wrapped with an error boundary to prevent one section's
 * failure from crashing the entire page.
 *
 * @page
 */

import { generateMetadata } from "@/lib/seo";
import { ProductStructuredData } from "@/components/seo/structured-data";
import { LandingPageSections } from "@/features/marketing/home/components/landing-page-sections";
import { ResumeLastVisited } from "@/features/marketing/home/components/resume-last-visited";
import { storefrontService } from "@/lib/services";

export const metadata = generateMetadata({
  title: "Epidom — Online Store, Menu & POS for F&B Businesses",
  description:
    "Create a menu page for Instagram, accept online payments, manage your cashier — all free. For cafés, restaurants, and warungs worldwide.",
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
  canonical: "https://epidom.fr",
  openGraph: {
    title: "Epidom — Online Store & POS for F&B",
    description: "Menu page, online orders, and POS cashier in one link. Free forever.",
    url: "https://epidom.fr",
    locale: "en_US",
  },
});

export default async function HomePage() {
  // Real, currently-published storefront to link as a live example — never
  // hardcoded (see storefrontService.getExampleStorefrontSlug), so it can't
  // go stale or 404 if that merchant unpublishes later.
  const exampleStorefrontSlug = await storefrontService.getExampleStorefrontSlug();

  return (
    <>
      <ProductStructuredData />
      <ResumeLastVisited />

      <main className="w-full overflow-x-hidden">
        <LandingPageSections exampleStorefrontSlug={exampleStorefrontSlug} />
      </main>
    </>
  );
}
