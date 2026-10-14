import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { BREADCRUMB_LABELS } from "@/lib/seo";
import { LandingPageView } from "./components/landing-page-view";
import { getLandingPage } from "./content";
import { buildLandingMetadata, landingUrl } from "./metadata";
import { landingLinksFor } from "./registry";

/** `export const generateMetadata = landingMetadata("kalkulator-hpp")` in a route file. */
export function landingMetadata(slug: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const page = getLandingPage(slug);
    return page ? buildLandingMetadata(page) : { title: "Not found | Epidom" };
  };
}

/**
 * The route body for a landing page. The proxy only lets the page's own
 * language through (other prefixes get a 308 to it), so the marketing
 * layout's i18n is already in the page's language here.
 */
export function LandingRoute({ slug, locale }: { slug: string; locale: Locale }) {
  const page = getLandingPage(slug);
  // Prerendered for every language segment; only its own language is a page
  // (the proxy 308s the others before they get here).
  if (!page || page.locale !== locale) notFound();

  // Other pages in the same language: tools first, then businesses, then features.
  const related = landingLinksFor(page.locale)
    .filter((link) => link.slug !== page.slug)
    .slice(0, 8)
    .map((link) => ({ href: getLocalizedPath(`/${link.slug}`, page.locale), label: link.label }));

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          {
            name: BREADCRUMB_LABELS[page.locale].home,
            url: `https://epidom.fr${getLocalizedPath("/", page.locale)}`,
          },
          { name: page.h1, url: landingUrl(page.slug, page.locale) },
        ]}
      />
      <LandingPageView page={page} related={related} />
    </>
  );
}
