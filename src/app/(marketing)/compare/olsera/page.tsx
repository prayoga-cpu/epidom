import { olseraComparison } from "@/features/marketing/compare/data/olsera";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(olseraComparison, [
    "alternatif olsera",
    "olsera vs epidom",
    "olsera alternative",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={olseraComparison} />;
}
