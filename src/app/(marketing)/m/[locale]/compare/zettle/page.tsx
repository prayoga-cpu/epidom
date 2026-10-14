import { zettleComparison } from "@/features/marketing/compare/data/zettle";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    zettleComparison,
    ["zettle alternative", "zettle vs epidom", "alternative zettle caisse"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={zettleComparison} locale={await routeLocale(params)} />;
}
