import { sundayComparison } from "@/features/marketing/compare/data/sunday";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    sundayComparison,
    ["sunday app alternative", "sunday vs epidom", "logiciel caisse restaurant gratuit vs sunday"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={sundayComparison} locale={await routeLocale(params)} />;
}
