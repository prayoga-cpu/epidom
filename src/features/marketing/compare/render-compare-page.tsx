import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { buildLocalizedMetadata, getAuthoredLocales, resolveServedLocale } from "@/lib/seo";
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
export async function resolveCompareData(
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>
): Promise<{ locale: Locale; servedLocale: Locale; data: CompetitorComparisonData }> {
  const headersList = await headers();
  const requested = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
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
export async function buildCompareMetadata(
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>,
  keywords: string[]
) {
  const { locale, data } = await resolveCompareData(dataMap);
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

export async function CompareCompetitorPage({
  dataMap,
}: {
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>;
}) {
  const { data } = await resolveCompareData(dataMap);
  return (
    <main className="w-full overflow-x-hidden">
      <CompetitorComparison data={data} />
    </main>
  );
}
