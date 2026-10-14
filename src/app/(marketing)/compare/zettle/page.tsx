import { zettleComparison } from "@/features/marketing/compare/data/zettle";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(zettleComparison, [
    "zettle alternative",
    "zettle vs epidom",
    "alternative zettle caisse",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={zettleComparison} />;
}
