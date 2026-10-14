import type { Locale } from "@/components/lang/i18n-provider";
import {
  BREADCRUMB_LABELS,
  buildBreadcrumbs,
  buildLocalizedMetadata,
  getAuthoredLocales,
  resolveServedLocale,
} from "@/lib/seo";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { CompetitorComparison } from "./components/competitor-comparison";
import type { CompetitorComparisonData } from "./types";

/**
 * Shared plumbing for /compare/[competitor] pages — each competitor is
 * only authored in the locales that are actually relevant to it (see the
 * data/*.ts files), so this resolves the visitor's locale and falls back
 * to English (worldwide) when that specific locale wasn't authored, rather
 * than 404ing or showing a locale that doesn't have real content.
 *
 * `locale` is what the visitor asked for; `servedLocale` is whose copy they
 * actually get. Metadata must be built from the latter (see
 * buildCompareMetadata), which is why both come back.
 */
export function resolveCompareData(
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>,
  requested: Locale
): { locale: Locale; servedLocale: Locale; data: CompetitorComparisonData } {
  const servedLocale = resolveServedLocale(getAuthoredLocales(dataMap), requested);
  return { locale: requested, servedLocale, data: dataMap[servedLocale]! };
}

/**
 * A visitor on a locale this competitor was never authored for gets the
 * fallback copy, so canonical points at that copy's own URL (otherwise
 * /id/compare/sunday, English text, would be a duplicate of /en/compare/sunday
 * that canonicalizes to itself) and hreflang lists only the authored locales.
 * Content and fallback behaviour are untouched — only what we tell crawlers.
 *
 * Built through buildLocalizedMetadata so the social card is complete: og:locale
 * follows the locale actually served (an /id visit that gets English copy says
 * en_US, not id_ID) and the share image and Twitter text are kept.
 */
export function buildCompareMetadata(
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>,
  keywords: string[],
  requested: Locale
) {
  const { locale, data } = resolveCompareData(dataMap, requested);
  return buildLocalizedMetadata({
    basePath: `/compare/${data.slug}`,
    locale,
    title: `${data.eyebrow} — EPIDOM`,
    description: data.lede,
    ogTitle: data.eyebrow,
    keywords,
    authoredLocales: getAuthoredLocales(dataMap),
  });
}

export function CompareCompetitorPage({
  dataMap,
  locale,
}: {
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>;
  /** The route's language (the copy served may fall back, see resolveCompareData). */
  locale: Locale;
}) {
  const { servedLocale, data } = resolveCompareData(dataMap, locale);
  return (
    <div className="w-full overflow-x-hidden">
      {/* In the served locale: the trail points at the copy the canonical names. */}
      <BreadcrumbStructuredData
        items={buildBreadcrumbs(servedLocale, [
          { name: BREADCRUMB_LABELS[servedLocale].compare, path: "/compare" },
          { name: data.eyebrow, path: `/compare/${data.slug}` },
        ])}
      />
      <CompetitorComparison data={data} />
    </div>
  );
}
