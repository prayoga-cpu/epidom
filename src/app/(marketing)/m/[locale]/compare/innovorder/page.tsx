import { innovorderComparison } from "@/features/marketing/compare/data/innovorder";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    innovorderComparison,
    ["innovorder alternative", "innovorder vs epidom", "alternative innovorder"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return (
    <CompareCompetitorPage dataMap={innovorderComparison} locale={await routeLocale(params)} />
  );
}
