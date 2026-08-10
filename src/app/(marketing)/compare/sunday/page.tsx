import { sundayComparison } from "@/features/marketing/compare/data/sunday";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(sundayComparison, [
    "sunday app alternative",
    "sunday vs epidom",
    "logiciel caisse restaurant gratuit vs sunday",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={sundayComparison} />;
}
