import { esbComparison } from "@/features/marketing/compare/data/esb";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(esbComparison, [
    "alternatif esb pos",
    "esb vs epidom",
    "esb pos alternative",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={esbComparison} />;
}
