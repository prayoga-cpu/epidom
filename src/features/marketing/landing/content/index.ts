import type { Locale } from "@/components/lang/i18n-provider";
import type { LandingPage } from "../types";
import { bakeryPages } from "./bakery";
import { cafePages } from "./cafe";
import { commissionPages } from "./commission";
import { kitchenDisplayPages } from "./kitchen-display";
import { offlinePages } from "./offline";
import { onlineOrderingPages } from "./online-ordering";
import { qrMenuPages } from "./qr-menu";
import { receiptPrinterPages } from "./receipt-printer";
import { recipeCostPages } from "./recipe-cost";
import { restaurantPages } from "./restaurant";
import { staffSchedulingPages } from "./staff-scheduling";
import { stockRecipesPages } from "./stock-recipes";

/**
 * Every landing page, server-side only: the pages render from here, and only
 * the one being viewed travels to the browser (as props). The site-wide
 * footer uses registry.ts (slugs + short labels) instead, so this prose never
 * ships on every page.
 */
export const LANDING_PAGES: readonly LandingPage[] = [
  ...recipeCostPages,
  ...commissionPages,
  ...qrMenuPages,
  ...onlineOrderingPages,
  ...cafePages,
  ...restaurantPages,
  ...bakeryPages,
  ...offlinePages,
  ...kitchenDisplayPages,
  ...stockRecipesPages,
  ...staffSchedulingPages,
  ...receiptPrinterPages,
];

const BY_SLUG = new Map(LANDING_PAGES.map((p) => [p.slug, p]));

export function getLandingPage(slug: string): LandingPage | undefined {
  return BY_SLUG.get(slug);
}

export function getLandingPages(locale: Locale): LandingPage[] {
  return LANDING_PAGES.filter((p) => p.locale === locale);
}
