import type { MetadataRoute } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { storefrontService } from "@/lib/services";
import { LOCALES, getLocalizedPath } from "@/lib/i18n-routing";
import { getAllBlogPostParams } from "@/features/marketing/blog/content";
import { getAllDocsParams } from "@/features/marketing/docs/content";

// Competitor comparison pages authored in only 1-2 locales (see
// src/features/marketing/compare/data/*.ts — each competitor is only
// relevant to one market). Listed explicitly per-locale here rather than
// through the generic LOCALES loop below, so we never publish a sitemap
// entry for a locale that falls back to identical English content — that
// would be a near-duplicate URL, not real unique content.
const COMPETITOR_COMPARE_ROUTES: Array<{ slug: string; locales: Locale[] }> = [
  { slug: "moka", locales: ["id", "en"] },
  { slug: "majoo", locales: ["id", "en"] },
  { slug: "klikit", locales: ["id", "en"] },
  { slug: "sunday", locales: ["fr", "en"] },
  { slug: "sumup-pos-pro", locales: ["fr", "en"] },
  { slug: "zelty", locales: ["fr", "en"] },
];

const BASE_URL = "https://epidom.fr";

// Static marketing routes. Keep in sync with src/app/(marketing)/*/page.tsx
// and the MARKETING_BASE_PATHS allowlist in src/middleware.ts.
// Auth-gated (app), API, and legal-boilerplate routes (privacy/terms/gdpr/
// cookie-policy/refund-policy) are intentionally excluded — low search value,
// not worth crawl budget. /payments is excluded too (noindex, see its metadata).
const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/partners", changeFrequency: "monthly", priority: 0.4 },
  { path: "/careers", changeFrequency: "monthly", priority: 0.3 },
  { path: "/press", changeFrequency: "monthly", priority: 0.3 },
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
  const now = new Date();

  // One sitemap entry per locale per route (fr unprefixed, id/en prefixed),
  // each carrying hreflang alternates to the other two.
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}${getLocalizedPath(route.path, locale)}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: localizedAlternates(route.path) },
    }))
  );

  // Blog posts and docs guides are locale-specific content (not translated
  // 1:1 across fr/id/en — see posts.*.ts), so each entry stands alone with
  // no hreflang alternates pointing at other locales.
  const blogEntries: MetadataRoute.Sitemap = getAllBlogPostParams().map(({ locale, slug }) => ({
    url: `${BASE_URL}${getLocalizedPath(`/blog/${slug}`, locale)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const docsEntries: MetadataRoute.Sitemap = getAllDocsParams().map(({ locale, slug }) => ({
    url: `${BASE_URL}${getLocalizedPath(`/docs/${slug}`, locale)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const competitorCompareEntries: MetadataRoute.Sitemap = COMPETITOR_COMPARE_ROUTES.flatMap(
    ({ slug, locales }) =>
      locales.map((locale) => ({
        url: `${BASE_URL}${getLocalizedPath(`/compare/${slug}`, locale)}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }))
  );

  let storefrontEntries: MetadataRoute.Sitemap = [];
  try {
    const storefronts = await storefrontService.getPublishedSlugsForSitemap();
    storefrontEntries = storefronts.map((s) => ({
      url: `${BASE_URL}/@${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch {
    // Sitemap must never 500 the whole route if the DB is briefly unavailable —
    // fall back to static routes only.
  }

  return [
    ...staticEntries,
    ...blogEntries,
    ...docsEntries,
    ...competitorCompareEntries,
    ...storefrontEntries,
  ];
}
