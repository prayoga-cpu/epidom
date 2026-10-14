import { klikitComparison } from "@/features/marketing/compare/data/klikit";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    klikitComparison,
    ["klikit alternative", "klikit vs epidom", "aplikasi kasir gratis vs klikit"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={klikitComparison} locale={await routeLocale(params)} />;
}
