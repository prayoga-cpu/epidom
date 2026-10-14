/**
 * Home Page (Landing Page)
 *
 * Landing page: make switching feel safe, and show what Epidom does for
 * margin. Composed of the sections in landing-page-sections.tsx (hero,
 * three spaces, margin calculator, trust bar, switch at your pace, hardware,
 * comparisons, pricing, case studies, switcher FAQ, final CTA; the problem
 * picker moved to /services). Each section is wrapped with an error
 * boundary to prevent one section's failure from crashing the entire page.
 *
 * @page
 */

import { ProductStructuredData } from "@/components/seo/structured-data";
import { LandingPageSections } from "@/features/marketing/home/components/landing-page-sections";
import { ResumeLastVisited } from "@/features/marketing/home/components/resume-last-visited";
import { storefrontService } from "@/lib/services";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = pageMetadata("home");

// Static, refreshed hourly: the only live data is the example storefront link.
export const revalidate = 3600;

export default async function HomePage({ params }: LocaleParams) {
  const locale = await routeLocale(params);
  // Real, currently-published storefront the Storefront card links to — never
  // hardcoded (see storefrontService.getExampleStorefrontSlug), so it can't
  // go stale or 404 if that merchant unpublishes later. Not awaited: the hero
  // (the LCP) streams without waiting on the database, the link fills in below
  // the fold when the query answers, and a failed query just hides it.
  const exampleStorefrontSlug = storefrontService.getExampleStorefrontSlug().catch(() => null);

  return (
    <>
      <ProductStructuredData locale={locale} />
      <ResumeLastVisited />

      <div className="w-full overflow-x-hidden">
        <LandingPageSections exampleStorefrontSlug={exampleStorefrontSlug} />
      </div>
    </>
  );
}
