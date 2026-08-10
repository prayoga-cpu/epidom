import { sumupPosProComparison } from "@/features/marketing/compare/data/sumup-pos-pro";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(sumupPosProComparison, [
    "tiller systems alternative",
    "sumup pos pro vs epidom",
    "caisse ipad restaurant gratuite",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={sumupPosProComparison} />;
}
