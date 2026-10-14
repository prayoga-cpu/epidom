import { majooComparison } from "@/features/marketing/compare/data/majoo";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    majooComparison,
    ["majoo alternative", "majoo vs epidom", "aplikasi kasir gratis vs majoo"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={majooComparison} locale={await routeLocale(params)} />;
}
