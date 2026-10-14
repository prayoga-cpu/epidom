import { pawoonComparison } from "@/features/marketing/compare/data/pawoon";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(pawoonComparison, [
    "alternatif pawoon",
    "pawoon vs epidom",
    "pawoon alternative",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={pawoonComparison} />;
}
