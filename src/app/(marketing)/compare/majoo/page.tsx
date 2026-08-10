import { majooComparison } from "@/features/marketing/compare/data/majoo";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(majooComparison, [
    "majoo alternative",
    "majoo vs epidom",
    "aplikasi kasir gratis vs majoo",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={majooComparison} />;
}
