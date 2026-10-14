import { zeltyComparison } from "@/features/marketing/compare/data/zelty";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export async function generateMetadata({ params }: LocaleParams) {
  return buildCompareMetadata(
    zeltyComparison,
    ["zelty alternative", "zelty vs epidom", "caisse restaurant prix public"],
    await routeLocale(params)
  );
}

export default async function Page({ params }: LocaleParams) {
  return <CompareCompetitorPage dataMap={zeltyComparison} locale={await routeLocale(params)} />;
}
