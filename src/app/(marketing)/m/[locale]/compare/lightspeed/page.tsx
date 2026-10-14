import { lightspeedComparison } from "@/features/marketing/compare/data/lightspeed";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    lightspeedComparison,
    ["lightspeed restaurant alternative", "lightspeed vs epidom", "alternative lightspeed"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return (
    <CompareCompetitorPage dataMap={lightspeedComparison} locale={await routeLocale(params)} />
  );
}
