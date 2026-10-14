import { sumupPosProComparison } from "@/features/marketing/compare/data/sumup-pos-pro";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    sumupPosProComparison,
    ["tiller systems alternative", "sumup pos pro vs epidom", "caisse ipad restaurant gratuite"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return (
    <CompareCompetitorPage dataMap={sumupPosProComparison} locale={await routeLocale(params)} />
  );
}
