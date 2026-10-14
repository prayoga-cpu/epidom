import { mokaComparison } from "@/features/marketing/compare/data/moka";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    mokaComparison,
    ["moka pos alternative", "moka pos vs epidom", "aplikasi kasir gratis vs moka"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={mokaComparison} locale={await routeLocale(params)} />;
}
