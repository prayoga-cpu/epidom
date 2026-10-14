import { ladditionComparison } from "@/features/marketing/compare/data/laddition";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(ladditionComparison, [
    "laddition alternative",
    "l'addition vs epidom",
    "alternative laddition",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={ladditionComparison} />;
}
