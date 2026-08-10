import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE, getLocalizedPath } from "@/lib/i18n-routing";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { CompetitorComparison } from "./components/competitor-comparison";
import type { CompetitorComparisonData } from "./types";

/**
 * Shared plumbing for /compare/[competitor] pages — each competitor is
 * only authored in the locales that are actually relevant to it (see the
 * data/*.ts files), so this resolves the visitor's locale and falls back
 * to English (worldwide) when that specific locale wasn't authored, rather
 * than 404ing or showing a locale that doesn't have real content.
 */
export async function resolveCompareData(
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>
): Promise<{ locale: Locale; data: CompetitorComparisonData }> {
  const headersList = await headers();
  const requested = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
  const data = dataMap[requested] ?? dataMap.en ?? Object.values(dataMap)[0]!;
  return { locale: requested, data };
}

export async function buildCompareMetadata(
  dataMap: Partial<Record<Locale, CompetitorComparisonData>>,
  keywords: string[]
) {
  const { locale, data } = await resolveCompareData(dataMap);
  const canonical = `https://epidom.fr${getLocalizedPath(`/compare/${data.slug}`, locale)}`;
  return buildMetadata({
    title: `${data.eyebrow} — EPIDOM`,
    description: data.lede,
    keywords,
    canonical,
    openGraph: { title: data.eyebrow, description: data.lede, url: canonical },
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
