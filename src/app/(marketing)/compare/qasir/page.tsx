import { qasirComparison } from "@/features/marketing/compare/data/qasir";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(qasirComparison, [
    "alternatif qasir",
    "qasir vs epidom",
    "qasir alternative",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={qasirComparison} />;
}
