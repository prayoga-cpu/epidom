import type { MetadataRoute } from "next";
import { storefrontService } from "@/lib/services";
import { LOCALES, getLocalizedPath } from "@/lib/i18n-routing";
import { buildAuthoredHreflang, getAuthoredLocales } from "@/lib/seo";
import { getAllBlogPostParams, getBlogPost } from "@/features/marketing/blog/content";
import { getAllDocsParams, getDocsGuide } from "@/features/marketing/docs/content";
import { klikitComparison } from "@/features/marketing/compare/data/klikit";
import { majooComparison } from "@/features/marketing/compare/data/majoo";
import { mokaComparison } from "@/features/marketing/compare/data/moka";
import { sumupPosProComparison } from "@/features/marketing/compare/data/sumup-pos-pro";
import { sundayComparison } from "@/features/marketing/compare/data/sunday";
import { zeltyComparison } from "@/features/marketing/compare/data/zelty";
import { ladditionComparison } from "@/features/marketing/compare/data/laddition";
import { lightspeedComparison } from "@/features/marketing/compare/data/lightspeed";
import { innovorderComparison } from "@/features/marketing/compare/data/innovorder";
import { popinaComparison } from "@/features/marketing/compare/data/popina";
import { zettleComparison } from "@/features/marketing/compare/data/zettle";
import { pawoonComparison } from "@/features/marketing/compare/data/pawoon";
import { qasirComparison } from "@/features/marketing/compare/data/qasir";
import { olseraComparison } from "@/features/marketing/compare/data/olsera";
import { esbComparison } from "@/features/marketing/compare/data/esb";
import { kasirPintarComparison } from "@/features/marketing/compare/data/kasir-pintar";
import { isStorefrontIndexable } from "@/features/storefront/lib/indexing";
import { LANDING_PAGES } from "@/features/marketing/landing/content";
import { landingHreflang, landingUrl } from "@/features/marketing/landing/metadata";
import type { LandingGroup } from "@/features/marketing/landing/registry";

// Competitor comparison pages, each authored in only 1-2 locales (each
// competitor is only relevant to one market). The locales are read off the
// data itself, so the sitemap can never list a locale that just falls back to
// identical English content — a near-duplicate URL, not real unique content —
// and always agrees with the hreflang the page itself emits (see
// buildCompareMetadata in compare/render-compare-page.tsx).
const COMPETITOR_COMPARISONS = [
  mokaComparison,
  majooComparison,
  klikitComparison,
  sundayComparison,
  sumupPosProComparison,
  zeltyComparison,
  ladditionComparison,
  lightspeedComparison,
  innovorderComparison,
  popinaComparison,
  zettleComparison,
  pawoonComparison,
  qasirComparison,
  olseraComparison,
  esbComparison,
  kasirPintarComparison,
];

const BASE_URL = "https://epidom.fr";

// Static marketing routes. Keep in sync with src/app/(marketing)/*/page.tsx
// and the LOCALIZED_MARKETING_PATHS allowlist in src/proxy.ts; the "sitemap vs
// PAGES" test in src/app/__tests__/sitemap.test.ts fails when a page in the
// metadata table (features/marketing/seo/page-metadata.ts) is neither listed
// here nor on its documented exclusion list.
// Auth-gated (app), API, and legal-boilerplate routes (privacy/terms/gdpr/
// cookie-policy/refund-policy) are intentionally excluded — low search value,
// not worth crawl budget.
// /careers, /press and /partners are placeholder pages for now (no roles, no
// press kit, no partner program yet) and are noindexed by their metadata
// (PAGES in page-metadata.ts), so they stay off the sitemap until they carry
// real content.
// /payments and /status are not listed either: those URLs are retired and
// 308-redirect (to /pricing and /contact), and a redirecting URL doesn't belong
// in a sitemap (they also stay out of robots.txt's disallow list on purpose, so
// a crawler can still reach the redirect and drop the old address).
//
// No `lastModified` on purpose. These pages have no content date to report, and
// stamping them with "now" makes every URL look freshly changed on every
// request — crawlers that see that learn to ignore lastmod for the whole site.
// Omitting it is honest; a wrong date isn't.
const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.6 },
  { path: "/build-with-us", changeFrequency: "monthly", priority: 0.4 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.5 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/compare/delivery-commission", changeFrequency: "monthly", priority: 0.7 },
];

function localizedAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = `${BASE_URL}${getLocalizedPath(path, locale)}`;
  }
  languages["x-default"] = languages[LOCALES[0]];
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // One sitemap entry per locale per route (fr unprefixed, id/en prefixed),
  // each carrying hreflang alternates to the other two.
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}${getLocalizedPath(route.path, locale)}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: localizedAlternates(route.path) },
    }))
  );

  // Blog posts and docs guides are locale-specific content (not translated
  // 1:1 across fr/id/en — see posts.*.ts), so each entry stands alone with
  // no hreflang alternates pointing at other locales.
  //
  // lastModified is the article's own `date`, passed through as the ISO string
  // it is (date-only is valid W3C Datetime, and we don't invent a time of day).
  // That is the publication date — there is no separate "updated" field, so an
  // edited article keeps its original lastmod until one exists.
  const blogEntries: MetadataRoute.Sitemap = getAllBlogPostParams().map(({ locale, slug }) => ({
    url: `${BASE_URL}${getLocalizedPath(`/blog/${slug}`, locale)}`,
    lastModified: getBlogPost(locale, slug)?.updated ?? getBlogPost(locale, slug)?.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const docsEntries: MetadataRoute.Sitemap = getAllDocsParams().map(({ locale, slug }) => ({
    url: `${BASE_URL}${getLocalizedPath(`/docs/${slug}`, locale)}`,
    lastModified: getDocsGuide(locale, slug)?.date,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // No lastModified: the comparison data carries no date.
  const competitorCompareEntries: MetadataRoute.Sitemap = COMPETITOR_COMPARISONS.flatMap(
    (dataMap) => {
      const authored = getAuthoredLocales(dataMap);
      if (authored.length === 0) return [];
      const path = `/compare/${dataMap[authored[0]]!.slug}`;
      const languages = buildAuthoredHreflang(path, authored);
      return authored.map((locale) => ({
        url: `${BASE_URL}${getLocalizedPath(path, locale)}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: { languages },
      }));
    }
  );

  // Only storefronts worth indexing: test pages and stores without a real menu
  // are noindexed by their own page, so listing them here would contradict it.
  // Search landing pages: each at its own slug in its own language, with its
  // siblings in the other languages (different slugs) as hreflang.
  const landingEntries: MetadataRoute.Sitemap = LANDING_PAGES.map((page) => ({
    url: landingUrl(page.slug, page.locale),
    lastModified: page.updated,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    alternates: { languages: landingHreflang(page.group as LandingGroup) },
  }));

  let storefrontEntries: MetadataRoute.Sitemap = [];
  try {
    const storefronts = await storefrontService.getPublishedSlugsForSitemap();
    // The profile page and the menu page (where the dishes and prices are).
    storefrontEntries = storefronts.filter(isStorefrontIndexable).flatMap((s) => [
      {
        url: `${BASE_URL}/@${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/@${s.slug}/menu`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      },
    ]);
  } catch {
    // Sitemap must never 500 the whole route if the DB is briefly unavailable —
    // fall back to static routes only.
  }

  return [
    ...staticEntries,
    ...blogEntries,
    ...docsEntries,
    ...competitorCompareEntries,
    ...landingEntries,
    ...storefrontEntries,
  ];
}
