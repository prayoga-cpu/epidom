import { kasirPintarComparison } from "@/features/marketing/compare/data/kasir-pintar";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    kasirPintarComparison,
    ["alternatif kasir pintar", "kasir pintar vs epidom", "kasir pintar alternative"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return (
    <CompareCompetitorPage dataMap={kasirPintarComparison} locale={await routeLocale(params)} />
  );
}
