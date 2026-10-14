import { qasirComparison } from "@/features/marketing/compare/data/qasir";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    qasirComparison,
    ["alternatif qasir", "qasir vs epidom", "qasir alternative"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={qasirComparison} locale={await routeLocale(params)} />;
}
