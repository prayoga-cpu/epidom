import type { TranslatedLocale, SalesPageTranslation } from "../lib/translate-sales-page";
import salesPage1En from "./sales-page-1.en";
import salesPage1Id from "./sales-page-1.id";
import salesPage2En from "./sales-page-2.en";
import salesPage2Id from "./sales-page-2.id";
import salesPage3En from "./sales-page-3.en";
import salesPage3Id from "./sales-page-3.id";

/**
 * Translation table per sales page and language. The French page is the
 * original; keys follow SALES_PAGES in src/lib/sales-pages.ts (a test keeps
 * them in step). Relative imports only: scripts/build-sales-pages.ts loads
 * this through tsx.
 */
export const SALES_PAGE_TRANSLATIONS: Record<string, Record<TranslatedLocale, SalesPageTranslation>> = {
  "sales-page-1": { en: salesPage1En, id: salesPage1Id },
  "sales-page-2": { en: salesPage2En, id: salesPage2Id },
  "sales-page-3": { en: salesPage3En, id: salesPage3Id },
};
