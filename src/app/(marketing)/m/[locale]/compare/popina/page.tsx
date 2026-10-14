import { popinaComparison } from "@/features/marketing/compare/data/popina";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    popinaComparison,
    ["popina alternative", "popina vs epidom", "alternative popina caisse"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={popinaComparison} locale={await routeLocale(params)} />;
}
