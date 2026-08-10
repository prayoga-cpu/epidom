import { mokaComparison } from "@/features/marketing/compare/data/moka";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(mokaComparison, [
    "moka pos alternative",
    "moka pos vs epidom",
    "aplikasi kasir gratis vs moka",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={mokaComparison} />;
}
