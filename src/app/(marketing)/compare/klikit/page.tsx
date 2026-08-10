import { klikitComparison } from "@/features/marketing/compare/data/klikit";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(klikitComparison, [
    "klikit alternative",
    "klikit vs epidom",
    "aplikasi kasir gratis vs klikit",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={klikitComparison} />;
}
