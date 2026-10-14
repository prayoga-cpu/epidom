import { lightspeedComparison } from "@/features/marketing/compare/data/lightspeed";
import {
  buildCompareMetadata,
  CompareCompetitorPage,
} from "@/features/marketing/compare/render-compare-page";

export async function generateMetadata() {
  return buildCompareMetadata(lightspeedComparison, [
    "lightspeed restaurant alternative",
    "lightspeed vs epidom",
    "alternative lightspeed",
  ]);
}

export default function Page() {
  return <CompareCompetitorPage dataMap={lightspeedComparison} />;
}
