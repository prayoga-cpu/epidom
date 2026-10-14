import { popinaComparison } from "@/features/marketing/compare/data/popina";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(popinaComparison, [
    "popina alternative",
    "popina vs epidom",
    "alternative popina caisse",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={popinaComparison} />;
}
