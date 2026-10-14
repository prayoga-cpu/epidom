import { pawoonComparison } from "@/features/marketing/compare/data/pawoon";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    pawoonComparison,
    ["alternatif pawoon", "pawoon vs epidom", "pawoon alternative"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={pawoonComparison} locale={await routeLocale(params)} />;
}
