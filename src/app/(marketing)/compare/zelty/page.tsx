import { zeltyComparison } from "@/features/marketing/compare/data/zelty";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(zeltyComparison, [
    "zelty alternative",
    "zelty vs epidom",
    "caisse restaurant prix public",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={zeltyComparison} />;
}
