import type { TranslatedLocale, SalesPageTranslation } from "../lib/translate-sales-page";
import salesPage1En from "./sales-page-1.en";
import salesPage1Id from "./sales-page-1.id";
import salesPage1Th from "./sales-page-1.th";
import salesPage2En from "./sales-page-2.en";
import salesPage2Id from "./sales-page-2.id";
import salesPage2Th from "./sales-page-2.th";
import salesPage3En from "./sales-page-3.en";
import salesPage3Id from "./sales-page-3.id";
import salesPage3Th from "./sales-page-3.th";
import salesPage4En from "./sales-page-4.en";
import salesPage4Id from "./sales-page-4.id";
import salesPage4Th from "./sales-page-4.th";

/**
 * Translation table per sales page and language. The French page is the
 * original; keys follow SALES_PAGES in src/lib/sales-pages.ts (a test keeps
 * them in step). Relative imports only: scripts/build-sales-pages.ts loads
 * this through tsx.
 */
export const SALES_PAGE_TRANSLATIONS: Record<string, Record<TranslatedLocale, SalesPageTranslation>> = {
  "sales-page-1": { en: salesPage1En, id: salesPage1Id, th: salesPage1Th },
  "sales-page-2": { en: salesPage2En, id: salesPage2Id, th: salesPage2Th },
  "sales-page-3": { en: salesPage3En, id: salesPage3Id, th: salesPage3Th },
  "sales-page-4": { en: salesPage4En, id: salesPage4Id, th: salesPage4Th },
};
