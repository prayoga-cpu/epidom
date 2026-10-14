import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "./types";
import { klikitComparison } from "./data/klikit";
import { majooComparison } from "./data/majoo";
import { mokaComparison } from "./data/moka";
import { sumupPosProComparison } from "./data/sumup-pos-pro";
import { sundayComparison } from "./data/sunday";
import { zeltyComparison } from "./data/zelty";
import { ladditionComparison } from "./data/laddition";
import { lightspeedComparison } from "./data/lightspeed";
import { innovorderComparison } from "./data/innovorder";
import { popinaComparison } from "./data/popina";
import { zettleComparison } from "./data/zettle";
import { pawoonComparison } from "./data/pawoon";
import { qasirComparison } from "./data/qasir";
import { olseraComparison } from "./data/olsera";
import { esbComparison } from "./data/esb";
import { kasirPintarComparison } from "./data/kasir-pintar";

// Competitor comparison pages, each authored in only 1-2 locales (each
// competitor is only relevant to one market). The locales are read off the
// data itself, so the sitemap can never list a locale that just falls back to
// identical English content — a near-duplicate URL, not real unique content —
// and always agrees with the hreflang the page itself emits (see
// buildCompareMetadata in compare/render-compare-page.tsx).
export const COMPETITOR_COMPARISONS: Array<Partial<Record<Locale, CompetitorComparisonData>>> = [
  mokaComparison,
  majooComparison,
  klikitComparison,
  sundayComparison,
  sumupPosProComparison,
  zeltyComparison,
  ladditionComparison,
  lightspeedComparison,
  innovorderComparison,
  popinaComparison,
  zettleComparison,
  pawoonComparison,
  qasirComparison,
  olseraComparison,
  esbComparison,
  kasirPintarComparison,
];
