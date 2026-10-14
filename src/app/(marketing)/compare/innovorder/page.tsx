import { innovorderComparison } from "@/features/marketing/compare/data/innovorder";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(innovorderComparison, [
    "innovorder alternative",
    "innovorder vs epidom",
    "alternative innovorder",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={innovorderComparison} />;
}
