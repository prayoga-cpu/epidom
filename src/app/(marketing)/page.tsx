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

import { ProductStructuredData } from "@/components/seo/structured-data";
import { LandingPageSections } from "@/features/marketing/home/components/landing-page-sections";
import { ResumeLastVisited } from "@/features/marketing/home/components/resume-last-visited";
import { storefrontService } from "@/lib/services";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("home");

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
