import { olseraComparison } from "@/features/marketing/compare/data/olsera";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    olseraComparison,
    ["alternatif olsera", "olsera vs epidom", "olsera alternative"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={olseraComparison} locale={await routeLocale(params)} />;
}
