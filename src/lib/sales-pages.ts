/**
 * The /sales-page-N landing pages: three versions of the same pitch, compared
 * to see which one turns visitors into signups. Each is in French (the
 * original), English and Indonesian.
 *
 * - The pages are static, self-contained HTML in public/sales-pages/:
 *   sales-page-N.html (French, the designer's original) and
 *   sales-page-N.{en,id}.html, generated from it by scripts/build-sales-pages.ts
 *   and the tables in src/features/marketing/sales-pages/translations/.
 * - URLs follow the marketing site: /sales-page-N is French, /en/… and /id/…
 *   are prefixed. The proxy lets them through without a session and sends an
 *   unprefixed visit to the visitor's language (isSalesPagePath); the rewrites
 *   in next.config.ts map each URL to its file.
 * - public/sales-pages/lang-switch.js draws Epidom's language switcher on them.
 * - public/sales-pages/tracker.js sends VIEW / CTA_CLICK / SCROLL_* events to
 *   /api/public/sales-pages/events and sets SALES_PAGE_COOKIE to the page and
 *   its language.
 * - When an account is created (email or Google), the Better Auth hook in
 *   src/lib/auth.ts reads that cookie and records a SIGNUP for the page.
 * - /admin/sales-pages shows the comparison, per language or all together.
 *
 * Adding a page: drop public/sales-pages/sales-page-N.html (with the tracker
 * and switcher <script>s, the hreflang links and data-cta on its buttons), add
 * its name here, add its two translation tables and run the build script.
 */
export const SALES_PAGES = ["sales-page-1", "sales-page-2", "sales-page-3"] as const;

export type SalesPage = (typeof SALES_PAGES)[number];

/** The languages every sales page exists in; fr is the original. Same set as the site's LOCALES. */
export const SALES_PAGE_LOCALES = ["fr", "en", "id"] as const;

export type SalesPageLocale = (typeof SALES_PAGE_LOCALES)[number];

/**
 * Holds the last sales page this browser opened and its language
 * ("sales-page-2.en"), no identifier. Set by public/sales-pages/tracker.js
 * (keep the name in step with it) and listed in the cookie policy
 * (cookiePolicy.s4 in the locales). Before the pages had languages it held the
 * page alone, which means French.
 */
export const SALES_PAGE_COOKIE = "epidom_sales_page";

export function isSalesPage(value: unknown): value is SalesPage {
  return typeof value === "string" && (SALES_PAGES as readonly string[]).includes(value);
}

export function isSalesPageLocale(value: unknown): value is SalesPageLocale {
  return typeof value === "string" && (SALES_PAGE_LOCALES as readonly string[]).includes(value);
}

/**
 * Whether an unprefixed path (stripLocalePrefix's basePath) is a sales page
 * URL. Any N counts: one with no file is a plain 404 from the rewrite.
 */
export function isSalesPagePath(basePath: string): boolean {
  return /^\/sales-page-\d+$/.test(basePath);
}

/** The sales page (and its language) named by SALES_PAGE_COOKIE in a Cookie header, if any. */
export function salesPageFromCookieHeader(
  cookieHeader: string | null | undefined
): { page: SalesPage; locale: SalesPageLocale } | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1 || pair.slice(0, eq).trim() !== SALES_PAGE_COOKIE) continue;
    const [page, locale = "fr", ...rest] = pair.slice(eq + 1).trim().split(".");
    return isSalesPage(page) && isSalesPageLocale(locale) && rest.length === 0
      ? { page, locale }
      : null;
  }
  return null;
}
