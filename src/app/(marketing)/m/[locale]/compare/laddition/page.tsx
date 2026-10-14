import { ladditionComparison } from "@/features/marketing/compare/data/laddition";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    ladditionComparison,
    ["laddition alternative", "l'addition vs epidom", "alternative laddition"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={ladditionComparison} locale={await routeLocale(params)} />;
}
