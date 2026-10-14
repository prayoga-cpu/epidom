import { esbComparison } from "@/features/marketing/compare/data/esb";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    esbComparison,
    ["alternatif esb pos", "esb vs epidom", "esb pos alternative"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={esbComparison} locale={await routeLocale(params)} />;
}
