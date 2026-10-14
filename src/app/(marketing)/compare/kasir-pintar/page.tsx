import { kasirPintarComparison } from "@/features/marketing/compare/data/kasir-pintar";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(kasirPintarComparison, [
    "alternatif kasir pintar",
    "kasir pintar vs epidom",
    "kasir pintar alternative",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={kasirPintarComparison} />;
}
