/**
 * The /sales-page-N landing pages: three versions of the same pitch, compared
 * to see which one turns visitors into signups.
 *
 * - The pages are static, self-contained HTML in public/sales-pages/, served
 *   at their slug by the rewrite in next.config.ts (the proxy matcher skips
 *   them, so they are public).
 * - public/sales-pages/tracker.js sends VIEW / CTA_CLICK / SCROLL_* events to
 *   /api/public/sales-pages/events and sets SALES_PAGE_COOKIE to the page's
 *   name.
 * - When an account is created (email or Google), the Better Auth hook in
 *   src/lib/auth.ts reads that cookie and records a SIGNUP for the page.
 * - /admin/sales-pages shows the comparison.
 *
 * Adding a page: drop public/sales-pages/sales-page-N.html (with the tracker
 * <script> and data-cta on its buttons) and add its name here.
 */
export const SALES_PAGES = ["sales-page-1", "sales-page-2", "sales-page-3"] as const;

export type SalesPage = (typeof SALES_PAGES)[number];

/**
 * Holds the name of the last sales page this browser opened, no identifier.
 * Set by public/sales-pages/tracker.js (keep the name in step with it) and
 * listed in the cookie policy (cookiePolicy.s4 in the locales).
 */
export const SALES_PAGE_COOKIE = "epidom_sales_page";

export function isSalesPage(value: unknown): value is SalesPage {
  return typeof value === "string" && (SALES_PAGES as readonly string[]).includes(value);
}

/** The sales page named by SALES_PAGE_COOKIE in a Cookie header, if any. */
export function salesPageFromCookieHeader(cookieHeader: string | null | undefined): SalesPage | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1 || pair.slice(0, eq).trim() !== SALES_PAGE_COOKIE) continue;
    const value = pair.slice(eq + 1).trim();
    return isSalesPage(value) ? value : null;
  }
  return null;
}
